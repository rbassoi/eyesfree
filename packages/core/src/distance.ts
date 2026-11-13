/**
 * Camera-based viewing-distance estimation (pure maths — no camera, no DOM).
 *
 * Pinhole camera model: `distance = focalPx × realSize / sizeInImagePx`.
 *
 * Two facial "rulers" are combined:
 * - **Iris diameter** ≈ 11.7 mm in almost all adults (very stable), but only a few pixels
 *   wide at 1 m on a webcam → noisy far away.
 * - **Inter-pupillary distance (IPD)** ≈ 63 mm on average (54–74 mm range) → many more
 *   pixels, robust far away, but person-specific.
 *
 * {@link FaceDistanceEstimator} learns the user's own IPD from the iris while the iris is
 * large enough (close to the screen), then relies on the IPD further away.
 */

/** Average adult horizontal visible iris diameter (mm). */
export const IRIS_DIAMETER_MM = 11.7;
/** Average adult inter-pupillary distance (mm). */
export const DEFAULT_IPD_MM = 63;
/** Typical horizontal field of view of camera types (degrees). */
export const CAMERA_FOV_DEG = { laptop: 62, phoneFront: 74 } as const;

/** Focal length in pixels from image width and horizontal field of view. */
export function focalLengthPx(imageWidthPx: number, horizontalFovDeg: number): number {
  return imageWidthPx / 2 / Math.tan(((horizontalFovDeg * Math.PI) / 180) / 2);
}

/** Distance (cm) of an object of `realSizeMm` that measures `sizePx` in the image. */
export function distanceFromSize(sizePx: number, realSizeMm: number, focalPx: number): number {
  if (!(sizePx > 0) || !(focalPx > 0)) return NaN;
  return (focalPx * realSizeMm) / sizePx / 10;
}

/** Focal length (px) that makes a measurement match a known distance — one-time calibration. */
export function focalFromKnownDistance(sizePx: number, realSizeMm: number, knownCm: number): number {
  return (sizePx * knownCm * 10) / realSizeMm;
}

/** Face measurements in image pixels (any detector: MediaPipe, ML Kit, ARKit, Vision…). */
export interface FaceMeasurement {
  /** Width of the image the measurements come from. */
  imageWidthPx: number;
  /** Distance between the two pupil / iris centres. */
  ipdPx?: number;
  /** Mean horizontal iris diameter (both eyes averaged when available). */
  irisDiameterPx?: number;
}

export interface DistanceEstimate {
  /** Smoothed distance in cm. */
  cm: number;
  /** Which ruler dominated. */
  method: 'iris' | 'ipd' | 'blend';
  /** The user's IPD as currently learned (mm). */
  ipdMm: number;
}

export interface FaceDistanceEstimatorOptions {
  /** Horizontal field of view used when `focalPx` is unknown. Default {@link CAMERA_FOV_DEG.laptop}. */
  fovDeg?: number;
  /** Known focal length in px for the measured image width (overrides `fovDeg`). */
  focalPx?: number;
  /** Starting IPD (mm). Default 63. */
  ipdMm?: number;
  /** Iris diameters below this many px are considered too noisy. Default 12. */
  minIrisPx?: number;
  /** Exponential smoothing factor 0–1 (higher = more reactive). Default 0.25. */
  smoothing?: number;
}

/** Stateful estimator: feed it one {@link FaceMeasurement} per video frame. */
export class FaceDistanceEstimator {
  private ipdMm: number;
  private ipdSamples = 0;
  private smoothed: number | null = null;
  private focalPx: number | null;
  private readonly fovDeg: number;
  private readonly minIrisPx: number;
  private readonly smoothing: number;

  constructor(options: FaceDistanceEstimatorOptions = {}) {
    this.ipdMm = options.ipdMm ?? DEFAULT_IPD_MM;
    this.focalPx = options.focalPx ?? null;
    this.fovDeg = options.fovDeg ?? CAMERA_FOV_DEG.laptop;
    this.minIrisPx = options.minIrisPx ?? 12;
    this.smoothing = options.smoothing ?? 0.25;
  }

  /** The user's IPD as learned so far (mm). */
  get learnedIpdMm(): number {
    return this.ipdMm;
  }

  /** Focal length (px) fixed by {@link calibrate} or the constructor, or null when estimated from the FOV. */
  get calibratedFocalPx(): number | null {
    return this.focalPx;
  }

  /** Forgets smoothing (e.g. after the face was lost for a while). */
  resetSmoothing(): void {
    this.smoothed = null;
  }

  /**
   * One-time calibration against a known distance (e.g. "hold the screen exactly 50 cm away"):
   * fixes the camera focal length for subsequent estimates.
   */
  calibrate(m: FaceMeasurement, knownCm: number): void {
    if (m.irisDiameterPx && m.irisDiameterPx >= this.minIrisPx) {
      this.focalPx = focalFromKnownDistance(m.irisDiameterPx, IRIS_DIAMETER_MM, knownCm);
    } else if (m.ipdPx) {
      this.focalPx = focalFromKnownDistance(m.ipdPx, this.ipdMm, knownCm);
    }
    this.smoothed = knownCm;
  }

  /** Feeds a measurement; returns the smoothed estimate, or null when nothing usable. */
  update(m: FaceMeasurement): DistanceEstimate | null {
    const f = this.focalPx ?? focalLengthPx(m.imageWidthPx, this.fovDeg);
    const irisOk = !!m.irisDiameterPx && m.irisDiameterPx >= this.minIrisPx;
    const fromIris = irisOk ? distanceFromSize(m.irisDiameterPx!, IRIS_DIAMETER_MM, f) : NaN;

    // Learn the user's IPD while the iris is a reliable ruler (running mean, capped weight).
    if (irisOk && m.ipdPx) {
      const ipd = (m.ipdPx / m.irisDiameterPx!) * IRIS_DIAMETER_MM;
      if (ipd > 48 && ipd < 80) {
        this.ipdSamples = Math.min(this.ipdSamples + 1, 50);
        this.ipdMm += (ipd - this.ipdMm) / this.ipdSamples;
      }
    }
    const fromIpd = m.ipdPx ? distanceFromSize(m.ipdPx, this.ipdMm, f) : NaN;

    let raw: number;
    let method: DistanceEstimate['method'];
    if (Number.isFinite(fromIris) && Number.isFinite(fromIpd)) {
      // Trust the iris more when it is big, the IPD more when the iris is small.
      const w = Math.min(1, Math.max(0, (m.irisDiameterPx! - this.minIrisPx) / (2 * this.minIrisPx)));
      raw = w * fromIris + (1 - w) * fromIpd;
      method = 'blend';
    } else if (Number.isFinite(fromIpd)) {
      raw = fromIpd;
      method = 'ipd';
    } else if (Number.isFinite(fromIris)) {
      raw = fromIris;
      method = 'iris';
    } else {
      return null;
    }

    this.smoothed = this.smoothed === null ? raw : this.smoothed + this.smoothing * (raw - this.smoothed);
    return { cm: Math.round(this.smoothed), method, ipdMm: Math.round(this.ipdMm * 10) / 10 };
  }
}

export type DistanceStatus = 'too-close' | 'ok' | 'too-far';

/**
 * Compares a measured distance with the target (the profile's `viewingDistance`).
 * Default tolerance ±20 % — camera estimates without calibration are about that accurate.
 */
export function distanceStatus(measuredCm: number, targetCm: number, tolerance = 0.2): DistanceStatus {
  if (measuredCm < targetCm * (1 - tolerance)) return 'too-close';
  if (measuredCm > targetCm * (1 + tolerance) * 1.5) return 'too-far';
  return 'ok';
}

/** Closest value of `options` to `cm`. */
export function nearestDistance(cm: number, options: readonly number[]): number {
  return options.reduce((best, d) => (Math.abs(d - cm) < Math.abs(best - cm) ? d : best), options[0] ?? cm);
}
