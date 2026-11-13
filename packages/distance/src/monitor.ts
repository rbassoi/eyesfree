import { CAMERA_FOV_DEG, FaceDistanceEstimator } from '@eyesfree/core';
import type { DistanceEstimate, FaceMeasurement } from '@eyesfree/core';
import { mediapipeFaceSource } from './mediapipe.js';
import type { FaceSource } from './mediapipe.js';

export type DistanceMonitorStatus = 'stopped' | 'starting' | 'measuring' | 'no-face' | 'error';

/** Why the camera could not start — map these to friendly, actionable messages. */
export type CameraErrorCode =
  /** The user or browser blocked camera access. */
  | 'denied'
  /** No camera on this device. */
  | 'no-camera'
  /** Another app (video call, camera app) is using the camera. */
  | 'busy'
  /** Page not served over HTTPS (or API unavailable). */
  | 'insecure'
  /** The face detector could not be downloaded (offline, firewall, ad blocker). */
  | 'load-failed'
  /** Starting took too long. */
  | 'timeout'
  | 'unknown';

/** Classifies an error thrown while starting the camera or the detector. */
export function classifyCameraError(error: unknown, stage: 'camera' | 'detector' | 'timeout'): CameraErrorCode {
  if (stage === 'timeout') return 'timeout';
  if (stage === 'detector') return 'load-failed';
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-camera';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  if (name === 'InsecureContextError' || name === 'TypeError') return 'insecure';
  return 'unknown';
}

class StageError extends Error {
  constructor(readonly stage: 'camera' | 'detector' | 'timeout', readonly cause: unknown) {
    super((cause as Error)?.message ?? String(cause));
    this.name = (cause as Error)?.name ?? 'Error';
  }
}

export interface DistanceReading {
  status: DistanceMonitorStatus;
  /** Smoothed distance in cm, or null when unknown. */
  cm: number | null;
  estimate?: DistanceEstimate;
  error?: unknown;
  /** Set when `status === 'error'`. */
  errorCode?: CameraErrorCode;
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
  /** Max time (ms) to wait for camera + detector to start. Default 45 000 (first download is ~4 MB). */
  startTimeoutMs?: number;
  document?: Document;
}

const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

const defaultCamera = () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error('Camera API unavailable (the page must be served over HTTPS)');
    e.name = 'InsecureContextError';
    return Promise.reject(e);
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
};

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const tag = <T>(p: Promise<T>, stage: 'camera' | 'detector') =>
        p.catch((e: unknown) => {
          throw new StageError(stage, e);
        });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new StageError('timeout', new Error('Camera start timed out'))),
          this.options.startTimeoutMs ?? 45000,
        );
      });
      const camera = tag((this.options.camera ?? defaultCamera)(), 'camera');
      // If anything fails, make sure a camera that did open is released.
      camera
        .then((s) => {
          // Opened after a timeout/failure/stop: close it right away.
          if (this.reading.status !== 'starting') s.getTracks().forEach((t) => t.stop());
          else this.stream = s;
        })
        .catch(() => undefined);
      const [stream] = await Promise.race([Promise.all([camera, tag(this.source.init(), 'detector')]), timeout]);
      clearTimeout(timer);
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
      clearTimeout(timer);
      this.startPromise = null;
      this.release();
      const stage = error instanceof StageError ? error.stage : 'camera';
      const cause = error instanceof StageError ? error.cause : error;
      this.set({ status: 'error', cm: null, error: cause, errorCode: classifyCameraError(cause, stage) });
      throw cause;
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
