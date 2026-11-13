import { CAMERA_FOV_DEG, FaceDistanceEstimator } from '@eyesfree/core';
import type { FaceDistanceEstimatorOptions, FaceMeasurement } from '@eyesfree/core';

/**
 * Builds a {@link FaceMeasurement} from two eye centres (in frame pixels) as returned by
 * ML Kit / Vision face detectors (e.g. `react-native-vision-camera-face-detector`).
 * Pass `irisDiameterPx` too if your detector provides iris contours.
 */
export function measurementFromEyes(
  leftEye: { x: number; y: number },
  rightEye: { x: number; y: number },
  frameWidthPx: number,
  irisDiameterPx?: number,
): FaceMeasurement {
  const m: FaceMeasurement = { imageWidthPx: frameWidthPx, ipdPx: Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y) };
  if (irisDiameterPx) m.irisDiameterPx = irisDiameterPx;
  return m;
}

/** A distance estimator preconfigured for phone front cameras. */
export function createPhoneDistanceEstimator(options: FaceDistanceEstimatorOptions = {}): FaceDistanceEstimator {
  return new FaceDistanceEstimator({ fovDeg: CAMERA_FOV_DEG.phoneFront, ...options });
}
