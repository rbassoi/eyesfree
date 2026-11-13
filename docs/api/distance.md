# `@eyesfree/distance` API

Opt-in, on-device camera distance measurement. Guide: [integrations/distance.md](../integrations/distance.md).

```bash
npm install @eyesfree/distance
```

## `new DistanceMonitor(options?)`

| Option | Default | Description |
|---|---|---|
| `source` | `mediapipeFaceSource()` | Face detector implementing `FaceSource`. |
| `fovDeg` | 74 on touch devices, else 62 | Camera horizontal field of view. |
| `focalPx` | | Known focal length (from `calibrate()`), overrides `fovDeg`. |
| `ipdMm` | 63 | Starting eye spacing (persist `learnedIpdMm` between sessions). |
| `intervalMs` | 150 | Time between measurements. |
| `camera` | front camera 1280×720 | `() => Promise<MediaStream>`. |

| Member | Description |
|---|---|
| `start()` | Asks for camera permission and starts measuring. Rejects when denied. Idempotent. |
| `stop()` | Turns the camera off. |
| `running` | `true` while the camera is on. |
| `subscribe(fn)` | `fn({ status, cm, estimate?, error? })` on every reading. `status`: `stopped`, `starting`, `measuring`, `no-face` or `error`. |
| `getReading()` | Last reading. |
| `calibrate(knownCm)` | One-time calibration at a known distance. Returns the focal length to persist. |
| `learnedIpdMm` | The user's eye spacing as learned from the iris. |
| `push(measurement \| null)` | Feeds a measurement manually (custom pipelines, tests). |

## `createDistanceGuard({ engine, monitor, locale?, messages?, tolerance?, showOk?, onStatus? })`

Shows a large, magnified status pill when the user is closer than `profile.viewingDistance × (1 − tolerance)` or much farther. It includes a "turn off camera" button. Returns a `remove()` function. Messages: `en`, `pt`, `es` (`GUARD_MESSAGES`).

## Face sources

| Export | Description |
|---|---|
| `mediapipeFaceSource({ tasksVisionUrl?, wasmUrl?, modelUrl?, delegate? })` | MediaPipe Face Landmarker (lazy-loaded). `MEDIAPIPE_DEFAULTS` holds the pinned CDN URLs. |
| `measureFromLandmarks(landmarks, width, height)` | 478-point MediaPipe landmarks → `{ ipdPx, irisDiameterPx }`. `LANDMARKS` holds the indices. |
| `candidateRegions(width, height, lastFace, scanIndex)` | The crop search strategy (exported for custom detectors). |

## Core maths (`@eyesfree/core`)

`FaceDistanceEstimator` (`update`, `calibrate`, `learnedIpdMm`, `calibratedFocalPx`, `resetSmoothing`), `focalLengthPx`, `distanceFromSize`, `focalFromKnownDistance`, `distanceStatus`, `nearestDistance`, `IRIS_DIAMETER_MM`, `DEFAULT_IPD_MM`, `CAMERA_FOV_DEG`.

## React Native (`@eyesfree/react-native`)

`measurementFromEyes(left, right, frameWidth, irisPx?)`, `createPhoneDistanceEstimator()`, `useDistanceEstimator()`, `useDistanceStatus(cm, tolerance?)`, `<EyesFreeDistanceHint measuredCm messages? style? />`.

## Calibrator integration

`<eyesfree-calibrator>.distanceMonitor = monitor` (or `openCalibratorDialog({ distanceMonitor })`) adds "📷 Measure with the camera" to step 1. The calibrator only depends on the structural `DistanceMonitorLike` interface. It stops the camera when leaving step 1, but only if it was the one that started it.
