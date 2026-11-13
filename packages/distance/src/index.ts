/**
 * @eyesfree/distance — measure how far the user is from the screen with the front camera
 * (on-device, opt-in) and remind them to stay where they see sharply.
 *
 * ```ts
 * import { DistanceMonitor, createDistanceGuard } from '@eyesfree/distance';
 * const monitor = new DistanceMonitor();
 * createDistanceGuard({ engine, monitor });
 * await monitor.start();               // asks for camera permission
 * ```
 *
 * Original project: https://github.com/rbassoi/eyesfree — Apache-2.0
 */
export { DistanceMonitor } from './monitor.js';
export type { DistanceMonitorOptions, DistanceMonitorStatus, DistanceReading } from './monitor.js';
export { candidateRegions, LANDMARKS, measureFromLandmarks, MEDIAPIPE_DEFAULTS, mediapipeFaceSource } from './mediapipe.js';
export type { FaceSource, MediaPipeSourceOptions } from './mediapipe.js';
export { createDistanceGuard, GUARD_MESSAGES } from './guard.js';
export type { DistanceGuardMessages, DistanceGuardOptions } from './guard.js';
