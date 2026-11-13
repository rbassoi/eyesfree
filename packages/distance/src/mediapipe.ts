import type { FaceMeasurement } from '@eyesfree/core';

/** Anything that turns a video frame into face measurements (pixels). */
export interface FaceSource {
  /** Loads models etc. Called once before the first `measure`. */
  init(): Promise<void>;
  /** Measures the face in the current video frame, or `null` when no face is found. */
  measure(video: HTMLVideoElement, timestampMs: number): FaceMeasurement | null;
  /** Frees resources. */
  close(): void;
}

export interface MediaPipeSourceOptions {
  /** ES module URL of `@mediapipe/tasks-vision` (self-host it for strict CSP / offline). */
  tasksVisionUrl?: string;
  /** Base URL of the MediaPipe WASM files. */
  wasmUrl?: string;
  /** URL of the face landmarker model (`face_landmarker.task`). */
  modelUrl?: string;
  /** `GPU` (default) or `CPU`. */
  delegate?: 'GPU' | 'CPU';
}

const MP_VERSION = '0.10.14';
export const MEDIAPIPE_DEFAULTS = Object.freeze({
  tasksVisionUrl: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`,
  wasmUrl: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
  modelUrl: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
});

/** MediaPipe Face Landmarker indices (478-point model with iris refinement). */
export const LANDMARKS = Object.freeze({
  rightIrisCenter: 468,
  rightIrisEdges: [469, 471] as const,
  leftIrisCenter: 473,
  leftIrisEdges: [474, 476] as const,
});

interface Point {
  x: number;
  y: number;
}

/** Converts normalised MediaPipe landmarks of one face into pixel measurements. */
export function measureFromLandmarks(landmarks: readonly Point[], width: number, height: number): FaceMeasurement | null {
  const p = (i: number) => {
    const l = landmarks[i];
    return l ? { x: l.x * width, y: l.y * height } : null;
  };
  const d = (a: Point | null, b: Point | null) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : NaN);
  const ipd = d(p(LANDMARKS.rightIrisCenter), p(LANDMARKS.leftIrisCenter));
  const irisR = d(p(LANDMARKS.rightIrisEdges[0]), p(LANDMARKS.rightIrisEdges[1]));
  const irisL = d(p(LANDMARKS.leftIrisEdges[0]), p(LANDMARKS.leftIrisEdges[1]));
  const irises = [irisR, irisL].filter(Number.isFinite);
  const m: FaceMeasurement = { imageWidthPx: width };
  if (Number.isFinite(ipd)) m.ipdPx = ipd;
  if (irises.length) m.irisDiameterPx = irises.reduce((a, b) => a + b, 0) / irises.length;
  return m.ipdPx || m.irisDiameterPx ? m : null;
}

interface FaceLandmarkerLike {
  detect(image: HTMLCanvasElement): { faceLandmarks: Point[][] };
  close(): void;
}

/** Region of the camera frame (sensor pixels). */
interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Last face seen: centre and inter-pupillary distance in sensor pixels. */
export interface LastFace {
  cx: number;
  cy: number;
  ipdPx: number;
}

/**
 * Regions to try, in order (stop at the first face found).
 *
 * The face detector downsizes its input to ~128 px, so a face 1 m from a 1280 px webcam
 * (~160 px wide) shrinks to ~16 px and is missed. Square crops sized to the face fix this:
 * crops are drawn at native resolution, so pixel distances inside them equal sensor pixels.
 *
 * - Face known → square crop around it, side ≈ 6 × IPD (min ¼ of the frame height), then
 *   the full frame.
 * - Face unknown → full frame, the centre square, then ONE square of a 3×2 scanning grid
 *   per call (`scanIndex`), so searching stays cheap.
 */
export function candidateRegions(width: number, height: number, last: LastFace | null, scanIndex = 0): Region[] {
  const square = (cx: number, cy: number, side: number): Region => {
    const s = Math.round(Math.min(Math.max(side, height / 4), height, width));
    return {
      x: Math.round(Math.min(Math.max(cx - s / 2, 0), width - s)),
      y: Math.round(Math.min(Math.max(cy - s / 2, 0), height - s)),
      w: s,
      h: s,
    };
  };
  const full: Region = { x: 0, y: 0, w: width, h: height };
  if (last) {
    const side = last.ipdPx * 6;
    return side < height * 0.9 ? [square(last.cx, last.cy, side), full] : [full];
  }
  const half = height / 2;
  const cols = 3;
  const rows = 2;
  const i = scanIndex % (cols * rows);
  const gx = ((i % cols) + 0.5) * (width / cols);
  const gy = (Math.floor(i / cols) + 0.5) * (height / rows);
  return [full, square(width / 2, height / 2, half), square(gx, gy, half)];
}

/**
 * Face source backed by Google MediaPipe Face Landmarker (Apache-2.0). The library and
 * model (~4 MB) are loaded lazily, only when the camera is turned on. Everything runs
 * on the device: no image ever leaves it.
 */
export function mediapipeFaceSource(options: MediaPipeSourceOptions = {}): FaceSource {
  const cfg = { ...MEDIAPIPE_DEFAULTS, ...options };
  let landmarker: FaceLandmarkerLike | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let last: LastFace | null = null;
  let misses = 0;
  let scan = 0;
  return {
    async init() {
      if (landmarker) return;
      // Non-literal specifier: bundlers leave it alone, the browser loads it at runtime.
      const url = cfg.tasksVisionUrl;
      const mp = (await import(/* @vite-ignore */ /* webpackIgnore: true */ url)) as {
        FilesetResolver: { forVisionTasks(wasm: string): Promise<unknown> };
        FaceLandmarker: { createFromOptions(fs: unknown, opts: unknown): Promise<FaceLandmarkerLike> };
      };
      const fileset = await mp.FilesetResolver.forVisionTasks(cfg.wasmUrl);
      landmarker = await mp.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: cfg.modelUrl, delegate: options.delegate ?? 'GPU' },
        // IMAGE mode: each call is independent, so full frames and crops can be mixed.
        runningMode: 'IMAGE',
        numFaces: 1,
      });
    },
    measure(video) {
      const W = video.videoWidth;
      const H = video.videoHeight;
      if (!landmarker || !W) return null;
      canvas ??= video.ownerDocument.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      for (const r of candidateRegions(W, H, last, scan++)) {
        canvas.width = r.w;
        canvas.height = r.h;
        ctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const face = landmarker.detect(canvas).faceLandmarks[0];
        if (!face) continue;
        const m = measureFromLandmarks(face, r.w, r.h);
        if (!m) continue;
        m.imageWidthPx = W; // focal length refers to the full sensor width
        const c = face[LANDMARKS.rightIrisCenter] && face[LANDMARKS.leftIrisCenter]
          ? {
              x: (face[LANDMARKS.rightIrisCenter]!.x + face[LANDMARKS.leftIrisCenter]!.x) / 2,
              y: (face[LANDMARKS.rightIrisCenter]!.y + face[LANDMARKS.leftIrisCenter]!.y) / 2,
            }
          : { x: 0.5, y: 0.5 };
        last = { cx: r.x + c.x * r.w, cy: r.y + c.y * r.h, ipdPx: m.ipdPx ?? W * 0.05 };
        misses = 0;
        return m;
      }
      // Keep tracking the last position briefly, then fall back to searching.
      if (++misses > 5) last = null;
      return null;
    },
    close() {
      landmarker?.close();
      landmarker = null;
      last = null;
    },
  };
}
