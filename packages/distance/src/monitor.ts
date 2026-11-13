import { CAMERA_FOV_DEG, FaceDistanceEstimator } from '@eyesfree/core';
import type { DistanceEstimate, FaceMeasurement } from '@eyesfree/core';
import { mediapipeFaceSource } from './mediapipe.js';
import type { FaceSource } from './mediapipe.js';

export type DistanceMonitorStatus = 'stopped' | 'starting' | 'measuring' | 'no-face' | 'error';

export interface DistanceReading {
  status: DistanceMonitorStatus;
  /** Smoothed distance in cm, or null when unknown. */
  cm: number | null;
  estimate?: DistanceEstimate;
  error?: unknown;
}

export interface DistanceMonitorOptions {
  /** Face detector. Default: MediaPipe (lazy-loaded). */
  source?: FaceSource;
  /** Camera horizontal field of view. Default: phone front camera on touch devices, laptop webcam otherwise. */
  fovDeg?: number;
  /** Known focal length in px (from a previous `calibrate()`), overrides `fovDeg`. */
  focalPx?: number;
  /** Starting inter-pupillary distance in mm (from a previous session). */
  ipdMm?: number;
  /** Time between measurements (ms). Default 150. */
  intervalMs?: number;
  /** Opens the camera. Default: `getUserMedia` front camera at 1280×720. */
  camera?: () => Promise<MediaStream>;
  document?: Document;
}

const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

const defaultCamera = () =>
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });

/**
 * Measures how far the user is from the screen with the front camera.
 *
 * Privacy: frames are analysed on the device and discarded; nothing is stored or sent.
 * The camera is only on between `start()` and `stop()`.
 *
 * ```ts
 * const monitor = new DistanceMonitor();
 * monitor.subscribe(r => console.log(r.cm));
 * await monitor.start();
 * ```
 */
export class DistanceMonitor {
  private readonly source: FaceSource;
  private readonly estimator: FaceDistanceEstimator;
  private readonly options: DistanceMonitorOptions;
  private readonly listeners = new Set<(r: DistanceReading) => void>();
  private reading: DistanceReading = { status: 'stopped', cm: null };
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastMeasurement: FaceMeasurement | null = null;
  private missed = 0;
  private startPromise: Promise<void> | null = null;

  constructor(options: DistanceMonitorOptions = {}) {
    this.options = options;
    this.source = options.source ?? mediapipeFaceSource();
    this.estimator = new FaceDistanceEstimator({
      fovDeg: options.fovDeg ?? (isTouch() ? CAMERA_FOV_DEG.phoneFront : CAMERA_FOV_DEG.laptop),
      ...(options.focalPx ? { focalPx: options.focalPx } : {}),
      ...(options.ipdMm ? { ipdMm: options.ipdMm } : {}),
    });
  }

  /** `true` while the camera is on. */
  get running(): boolean {
    return this.reading.status !== 'stopped' && this.reading.status !== 'error';
  }

  getReading(): DistanceReading {
    return this.reading;
  }

  /** Listener is called on every reading. @returns unsubscribe */
  subscribe(listener: (r: DistanceReading) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Turns the camera on and starts measuring. Idempotent. Rejects when the camera is denied. */
  start(): Promise<void> {
    if (!this.startPromise) this.startPromise = this.doStart();
    return this.startPromise;
  }

  private async doStart(): Promise<void> {
    this.set({ status: 'starting', cm: null });
    try {
      const [stream] = await Promise.all([(this.options.camera ?? defaultCamera)(), this.source.init()]);
      this.stream = stream;
      const doc = this.options.document ?? document;
      const video = doc.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* some environments (tests) cannot play; measurement simply waits for frames */
      }
      this.video = video;
      this.set({ status: 'no-face', cm: null });
      this.loop();
    } catch (error) {
      this.startPromise = null;
      this.release();
      this.set({ status: 'error', cm: null, error });
      throw error;
    }
  }

  /** Turns the camera off. */
  stop(): void {
    this.startPromise = null;
    this.release();
    this.estimator.resetSmoothing();
    this.set({ status: 'stopped', cm: null });
  }

  /**
   * Calibrates the camera with the user at a known distance (e.g. measured with a tape):
   * improves accuracy from ~±20 % to ~±5 %. Returns the focal length to persist, or null.
   */
  calibrate(knownCm: number): number | null {
    if (!this.lastMeasurement) return null;
    this.estimator.calibrate(this.lastMeasurement, knownCm);
    return this.estimator.calibratedFocalPx;
  }

  /** The user's inter-pupillary distance as learned (mm) — persist it to start better next time. */
  get learnedIpdMm(): number {
    return this.estimator.learnedIpdMm;
  }

  /** Processes one measurement (exposed for custom pipelines and tests). */
  push(m: FaceMeasurement | null): DistanceReading {
    if (!m) {
      this.missed++;
      if (this.missed > 6) {
        this.estimator.resetSmoothing();
        this.set({ status: 'no-face', cm: null });
      }
      return this.reading;
    }
    this.missed = 0;
    this.lastMeasurement = m;
    const estimate = this.estimator.update(m);
    if (estimate) this.set({ status: 'measuring', cm: estimate.cm, estimate });
    return this.reading;
  }

  private loop(): void {
    const tick = () => {
      if (!this.video) return;
      try {
        this.push(this.source.measure(this.video, performance.now()));
      } catch (error) {
        this.set({ status: 'error', cm: null, error });
        return;
      }
      this.timer = setTimeout(tick, this.options.intervalMs ?? 150);
    };
    tick();
  }

  private release(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
  }

  private set(r: DistanceReading): void {
    this.reading = r;
    for (const l of this.listeners) {
      try {
        l(r);
      } catch (e) {
        console.error('[eyesfree] distance listener error', e);
      }
    }
  }
}
