import { compensatePixels, convolveRGBA, createRenderPlan, toneMapRGBA } from '@eyesfree/core';
import type { RenderPlan, VisionProfile } from '@eyesfree/core';

/** Minimal raster shape (`ImageData` satisfies it). */
export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type PlanInput = RenderPlan | Partial<VisionProfile> | VisionProfile;

interface WorkerRequest {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  tone: { slope: number; intercept: number } | null;
  kernels: number[][];
}

interface WorkerResponse {
  id: number;
  buffer?: ArrayBuffer;
  error?: string;
}

/**
 * Source code of the EyesFree image worker. It embeds the exact same pixel functions as
 * `@eyesfree/core`, so worker and main-thread output are bit-identical.
 *
 * For strict CSP (`worker-src` without `blob:`), write this string to a static file
 * (the browser bundle ships it as `eyesfree.worker.js`) and pass its URL as `workerUrl`.
 */
export function createWorkerSource(): string {
  return [
    '"use strict";',
    `var convolveRGBA = ${convolveRGBA.toString()};`,
    `var toneMapRGBA = ${toneMapRGBA.toString()};`,
    'self.onmessage = function (e) {',
    '  var m = e.data;',
    '  try {',
    '    var buf = new Uint8ClampedArray(m.buffer);',
    '    if (m.tone) toneMapRGBA(buf, m.tone.slope, m.tone.intercept);',
    '    for (var i = 0; i < m.kernels.length; i++) buf = convolveRGBA(buf, m.width, m.height, m.kernels[i]);',
    '    self.postMessage({ id: m.id, buffer: buf.buffer }, [buf.buffer]);',
    '  } catch (err) {',
    '    self.postMessage({ id: m.id, error: String(err && err.message || err) });',
    '  }',
    '};',
  ].join('\n');
}

export interface ImageCompensatorOptions {
  /**
   * - `auto` (default): use a Web Worker when available, fall back to the main thread.
   * - `worker`: require a worker (rejects if it cannot be created).
   * - `main-thread`: never spawn a worker.
   */
  mode?: 'auto' | 'worker' | 'main-thread';
  /** URL of a static worker script (CSP-friendly). Default: an inline `blob:` worker. */
  workerUrl?: string | URL;
}

const toPlan = (input: PlanInput): RenderPlan =>
  'kernels' in input && Array.isArray((input as RenderPlan).kernels) ? (input as RenderPlan) : createRenderPlan(input as Partial<VisionProfile>);

const makeImageData = (data: Uint8ClampedArray, width: number, height: number): PixelBuffer => {
  if (typeof ImageData !== 'undefined') {
    try {
      return new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height);
    } catch {
      /* fall through (e.g. non-browser environment) */
    }
  }
  return { data, width, height };
};

/**
 * Applies EyesFree compensation to raster content (canvas, charts, maps, rendered PDFs,
 * photos of documents…) off the main thread.
 *
 * ```ts
 * const compensator = new ImageCompensator();
 * await compensator.compensateCanvas(canvas, eyesfree.getProfile());
 * ```
 */
export class ImageCompensator {
  private worker: Worker | null = null;
  private workerUrlToRevoke: string | null = null;
  private broken = false;
  private seq = 0;
  private readonly pending = new Map<
    number,
    { resolve: (b: PixelBuffer) => void; reject: (e: unknown) => void; input: PixelBuffer; plan: RenderPlan }
  >();

  constructor(private readonly options: ImageCompensatorOptions = {}) {}

  /** `true` when work is executed in a Web Worker. */
  get usesWorker(): boolean {
    return this.ensureWorker() !== null;
  }

  /**
   * Compensates a pixel buffer. The input is not modified.
   * @param plan a render plan, or a (partial) profile
   */
  process(image: PixelBuffer, plan: PlanInput): Promise<PixelBuffer> {
    const p = toPlan(plan);
    const { width, height } = image;
    if (!p.active || (p.tone === null && p.kernels.length === 0)) {
      return Promise.resolve(makeImageData(new Uint8ClampedArray(image.data), width, height));
    }
    const worker = this.ensureWorker();
    if (!worker) {
      if (this.options.mode === 'worker') return Promise.reject(new Error('[eyesfree] Web Worker unavailable'));
      return Promise.resolve(this.runMainThread(image, p));
    }
    return new Promise<PixelBuffer>((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject, input: image, plan: p });
      const copy = new Uint8ClampedArray(image.data);
      const msg: WorkerRequest = {
        id,
        width,
        height,
        buffer: copy.buffer as ArrayBuffer,
        tone: p.tone,
        kernels: p.kernels.map((k) => k.matrix),
      };
      worker.postMessage(msg, [msg.buffer]);
    });
  }

  /** Compensates a canvas in place. */
  async compensateCanvas(canvas: HTMLCanvasElement | OffscreenCanvas, plan: PlanInput): Promise<void> {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('[eyesfree] 2D context unavailable');
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = await this.process(src, plan);
    const imageData =
      typeof ImageData !== 'undefined' && out instanceof ImageData
        ? out
        : new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, out.width, out.height);
    ctx.putImageData(imageData, 0, 0);
  }

  /** Draws an image/bitmap/video frame into a new canvas and compensates it. */
  async compensateImage(
    source: CanvasImageSource & { width: number; height: number },
    plan: PlanInput,
    doc: Document = document,
  ): Promise<HTMLCanvasElement> {
    const w = 'naturalWidth' in source && source.naturalWidth ? source.naturalWidth : source.width;
    const h = 'naturalHeight' in source && source.naturalHeight ? source.naturalHeight : source.height;
    const canvas = doc.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[eyesfree] 2D context unavailable');
    ctx.drawImage(source, 0, 0, w, h);
    await this.compensateCanvas(canvas, plan);
    return canvas;
  }

  /** Stops the worker. Pending jobs are finished on the main thread. */
  terminate(): void {
    this.teardown();
    this.flushPendingOnMainThread();
  }

  private runMainThread(image: PixelBuffer, plan: RenderPlan): PixelBuffer {
    return makeImageData(compensatePixels(image.data, image.width, image.height, plan), image.width, image.height);
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.broken || this.options.mode === 'main-thread' || typeof Worker === 'undefined') return null;
    try {
      let url: string;
      if (this.options.workerUrl) {
        url = String(this.options.workerUrl);
      } else {
        if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return null;
        url = URL.createObjectURL(new Blob([createWorkerSource()], { type: 'text/javascript' }));
        this.workerUrlToRevoke = url;
      }
      const w = new Worker(url);
      w.onmessage = (ev: MessageEvent<WorkerResponse>) => this.onWorkerMessage(ev.data);
      w.onerror = (ev) => {
        ev.preventDefault?.();
        this.broken = true;
        this.teardown();
        this.flushPendingOnMainThread();
      };
      this.worker = w;
      return w;
    } catch {
      this.broken = true;
      this.teardown();
      return null;
    }
  }

  private onWorkerMessage(msg: WorkerResponse): void {
    const job = this.pending.get(msg.id);
    if (!job) return;
    this.pending.delete(msg.id);
    if (msg.error || !msg.buffer) {
      // Retry on the main thread rather than failing the caller.
      try {
        job.resolve(this.runMainThread(job.input, job.plan));
      } catch (e) {
        job.reject(e);
      }
      return;
    }
    job.resolve(makeImageData(new Uint8ClampedArray(msg.buffer), job.input.width, job.input.height));
  }

  private flushPendingOnMainThread(): void {
    for (const [id, job] of this.pending) {
      this.pending.delete(id);
      try {
        job.resolve(this.runMainThread(job.input, job.plan));
      } catch (e) {
        job.reject(e);
      }
    }
  }

  private teardown(): void {
    this.worker?.terminate();
    this.worker = null;
    if (this.workerUrlToRevoke) {
      URL.revokeObjectURL(this.workerUrlToRevoke);
      this.workerUrlToRevoke = null;
    }
  }
}
