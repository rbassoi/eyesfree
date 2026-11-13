# Camera distance: sites on a computer and apps on a phone

People who use **reading glasses** (presbyopia) can still see text *sharply* without them, just **farther away**. The calibrator records that distance (`profile.viewingDistance`) and the magnification that goes with it (`fontScale`). The camera adds two things:

1. **Measure instead of guess.** In step 1, the user taps "📷 Measure with the camera" and the distance is selected automatically.
2. **Stay there.** A large on-screen hint appears when the user drifts closer than the distance at which they see sharply ("Move back a little: you are about 70 cm away, the best is 1 m").

> **Privacy.** Frames are analysed on the device, then discarded. Nothing is stored or sent, and no face data is kept except two numbers you may choose to persist (camera focal length, the user's eye spacing). The camera is only on while the user explicitly enables it, and the browser shows its own camera indicator. Tell users this in plain words; the calibrator already does.

## The two use cases are different

| | Sites on a computer | Apps on a phone |
|---|---|---|
| Typical sharp distance without reading glasses | 0.8–1.5 m: easy, just sit back | Limited by arm length: **≈ 50–65 cm** |
| What to expect | **Truly sharp** text with `fontScale` ≈ distance ÷ 40 cm (1 m → 250 %) | Sharp only for milder presbyopia (about +1.50 or less). With +2.00 or more, arm's length is still too close, so you get *larger and more legible* text, not perfectly sharp |
| Camera | Webcam via `@eyesfree/distance` (MediaPipe, in the browser) | Front camera via your app's camera library (ML Kit / Vision) + `@eyesfree/react-native` helpers |
| Default field of view | 62° (laptop webcam) | 74° (phone front camera) |
| Recommended | Calibrate on the computer; turn the camera guard on while reading | Calibrate **separately** on the phone (profiles are stored per device). Enable sharpening in the optional steps, because the phone is usually still inside the blur zone |

## Websites and web apps (computer)

```bash
npm install @eyesfree/web @eyesfree/calibrator @eyesfree/distance
```

```ts
import { createEyesFree } from '@eyesfree/web';
import { openCalibratorDialog } from '@eyesfree/calibrator';
import { DistanceMonitor, createDistanceGuard } from '@eyesfree/distance';

const engine = createEyesFree({ root: '#app' });
const monitor = new DistanceMonitor();            // camera stays off until start()

// "Move back a little" hint, sized with the user's magnification.
createDistanceGuard({ engine, monitor, locale: 'pt-BR' });

// Calibration with the camera button in step 1.
glassesButton.onclick = () => openCalibratorDialog({ engine, distanceMonitor: monitor }).element.start();

// A visible, explicit toggle for the reading guard.
cameraToggle.onclick = () => (monitor.running ? monitor.stop() : monitor.start());
```

With the single-file bundle, everything is on the `eyesfree` global (`eyesfree.DistanceMonitor`, `eyesfree.createDistanceGuard`).

### How it measures

1. MediaPipe Face Landmarker (Apache-2.0, loaded lazily from jsDelivr, ~4 MB the first time) finds the eyes and irises.
2. **Iris diameter** (≈ 11.7 mm in almost every adult) gives the distance while the user is close. It also *learns the user's own eye spacing*.
3. Farther away the iris is only a few pixels wide, so the **eye spacing** takes over.
4. A face 1 m+ from the webcam is tiny, so the detector also searches face-sized **square crops** (tracking the last position, or scanning a grid).

Accuracy is about **±20 %** without calibration, because webcam fields of view vary. For about ±5 %, calibrate once with a tape measure:

```ts
// user sits exactly 60 cm from the screen
const focalPx = monitor.calibrate(60);
localStorage.setItem('eyesfree:focal', String(focalPx));
// next time:
new DistanceMonitor({ focalPx: Number(localStorage.getItem('eyesfree:focal')) || undefined, ipdMm: savedIpd });
```

### Self-hosting MediaPipe (strict CSP / offline / intranet)

Copy `@mediapipe/tasks-vision@0.10.14` (`vision_bundle.mjs` and the `wasm/` folder) and `face_landmarker.task` to your server:

```ts
import { DistanceMonitor, mediapipeFaceSource } from '@eyesfree/distance';
const monitor = new DistanceMonitor({
  source: mediapipeFaceSource({
    tasksVisionUrl: '/vendor/mediapipe/vision_bundle.mjs',
    wasmUrl: '/vendor/mediapipe/wasm',
    modelUrl: '/vendor/mediapipe/face_landmarker.task',
  }),
});
```

### Any other detector

Implement `FaceSource` (`init`, `measure(video) → { imageWidthPx, ipdPx?, irisDiameterPx? }`, `close`) to use TensorFlow.js, OpenCV.js, a WebGPU model or a native bridge.

## Mobile apps (phone)

### React Native / Expo

The distance maths, a status hook and a hint component come from `@eyesfree/react-native`. The **camera and face detection come from your app**, because EyesFree stays free of native code. Example with `react-native-vision-camera` + `react-native-vision-camera-face-detector` (ML Kit):

```tsx
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { EyesFreeDistanceHint, measurementFromEyes, useDistanceEstimator } from '@eyesfree/react-native';

export function ReadingScreen() {
  const device = useCameraDevice('front');
  const estimator = useDistanceEstimator();          // phone FOV preset
  const [cm, setCm] = useState<number | null>(null);
  const { detectFaces } = useFaceDetector({ landmarkMode: 'all', performanceMode: 'fast' });

  const onFace = Worklets.createRunOnJS((left: Pt, right: Pt, width: number) => {
    setCm(estimator.update(measurementFromEyes(left, right, width))?.cm ?? null);
  });
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const face = detectFaces(frame)[0];
    if (face?.landmarks?.LEFT_EYE && face.landmarks.RIGHT_EYE) {
      onFace(face.landmarks.LEFT_EYE, face.landmarks.RIGHT_EYE, frame.width);
    }
  }, [detectFaces]);

  return (
    <>
      {device && <Camera style={{ width: 1, height: 1 }} device={device} isActive frameProcessor={frameProcessor} />}
      <EyesFreeDistanceHint measuredCm={cm} />
      {/* your screen */}
    </>
  );
}
```

> This recipe has not yet been tested on devices. Library APIs change between versions, so check them in your app. If your frame is rotated (portrait), use the frame dimension that matches the axis between the eyes.

`useDistanceStatus(cm)` returns `{ status: 'too-close' | 'ok' | 'too-far' | 'idle', targetCm }` if you prefer your own UI. To calibrate the phone, ask the user to hold it at a known distance and call `estimator.calibrate(measurement, 40)`.

### Native iOS

On iPhones with Face ID, ARKit gives the distance directly and precisely (TrueDepth), with no maths needed:

```swift
func renderer(_ r: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
  guard let face = anchor as? ARFaceAnchor else { return }
  let cm = Double(simd_length(face.transform.columns.3)) * 100   // camera → face, metres → cm
  DispatchQueue.main.async { self.updateHint(cm, target: profile.viewingDistance) }
}
```

Without TrueDepth, use Vision `VNDetectFaceLandmarksRequest` pupils plus the same pinhole formula: `cm = focalPx × 6.3 / ipdPx` with `focalPx = (width / 2) / tan(fov / 2)`.

### Native Android

Use ML Kit Face Detection (`FaceLandmark.LEFT_EYE` / `RIGHT_EYE`) and the same formula. CameraX `CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS` with `SENSOR_INFO_PHYSICAL_SIZE` gives the true focal length, so no FOV guess is needed.

## UX recommendations

- Ask for the camera **only after explaining why**, and offer the manual distance choice as an equal alternative.
- Show a clear **camera on/off** control while it runs (the guard includes one).
- Do not run the camera all the time. Turn it on for reading sessions or a few seconds after the app opens.
- Respect `prefers-reduced-motion` and keep hints calm. The guard only reacts to ±20 % changes.
