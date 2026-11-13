# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-11-13

### Added
- **`@eyesfree/distance`** (new package): opt-in, on-device camera distance measurement.
  - `DistanceMonitor`: front camera + MediaPipe Face Landmarker (Apache-2.0, lazy-loaded,
    self-hostable). Iris diameter (11.7 mm) is used up close and *learns the user's own eye
    spacing*, which then measures robustly from 1 m+. Face-sized square crops (tracking or
    grid scan) find faces too small for the detector in the full frame. ±20 % uncalibrated,
    ≈ ±5 % after `calibrate(knownCm)`.
  - `createDistanceGuard()`: large, magnified "move back a little" hint (en / pt / es).
- Calibrator: "📷 Measure with the camera" in step 1 selects the distance automatically
  (`distanceMonitor` property / `openCalibratorDialog({ distanceMonitor })`).
- Core: `FaceDistanceEstimator`, `focalLengthPx`, `distanceFromSize`, `focalFromKnownDistance`,
  `distanceStatus`, `nearestDistance`, `IRIS_DIAMETER_MM`, `DEFAULT_IPD_MM`, `CAMERA_FOV_DEG`.
- React Native: `measurementFromEyes`, `createPhoneDistanceEstimator`, `useDistanceEstimator`,
  `useDistanceStatus`, `<EyesFreeDistanceHint>`; documented recipes for VisionCamera + ML Kit,
  ARKit (TrueDepth) and Android ML Kit.
- Docs: [camera distance guide](docs/integrations/distance.md), covering sites on a computer
  vs apps on a phone (arm's length limits phone use for stronger reading prescriptions).
- Demo: camera toggle, live reading, and the distance guard.

## [0.3.0] - 2026-11-13

A +2.50 reading-glasses user still could not see anything sharp at 30 cm with 0.2. Screen
filters cannot undo blur that happens inside the eye. They did, however, read sharply **at 1 m
with 250 % zoom**, so this release makes that the main path.

### Added
- **Distance mode.** The calibrator now starts with "move back until these letters are sharp:
  how far are you?" (40 cm–2 m) and suggests the matching magnification
  (`suggestFontScale(cm)` = distance ÷ 40 cm, so 1 m → 250 %).
- From step 2 the wizard **magnifies itself** (CSS `zoom`) so it stays readable from the chair,
  while previews are still rendered at their true on-screen size.
- New profile field `viewingDistance` (cm, 0–300) and `RenderPlan.viewingDistanceCm`, so apps
  can remind users where to sit. EF1 codes gain an optional 5th segment.
- "Apply" is available right after the size step; sharpening and doubled-letter steps are now
  optional ("More adjustments").
- `DISTANCE_OPTIONS_CM`, `REFERENCE_READING_DISTANCE_CM`, `VIEWING_DISTANCE_RANGE`,
  `DISTANCE_CHOICES` and `sizeOptionsAround()`.

### Changed
- `fontScale` range widened from 1–2 to **1–4**.
- The calibrator has 4 steps (distance, size, sharpness, doubled letters) and the dialog is
  wider (up to 1100 px). New message keys: `distanceInstruction`, `distanceGroupLabel`,
  `distanceOption`, `distanceNormal`, `distanceSampleText`, `sizeSample` and `moreAdjustments`.
- Choosing a distance beyond 40 cm sets `sharpness: 'none'`, because at a focused distance
  sharpening is unnecessary.

## [0.2.0] - 2026-11-13

Field testing showed that 0.1 produced no perceptible benefit: its 3×3 kernels act on a ~1 px
neighbourhood, while an uncorrected eye at reading distance blurs over ~5–20 CSS px. This release
re-centres EyesFree on what physically helps.

### Added
- **Text magnification** (`fontScale`) is now applied on the web through CSS `zoom` on the root's
  children, so layout reflows. New engine option `magnify` (default `true`).
- **Large-radius pre-sharpening**: new profile field `blurRadius` (Gaussian σ in CSS px, 0–12,
  default 3) and `RenderPlan.unsharp`. It is rendered as `feGaussianBlur` + `feComposite
  arithmetic` on the web, and by the new self-contained `unsharpRGBA()` in the Web Worker and core.
- **Stroke thickening** (`RenderPlan.textStrokePx`, `--eyesfree-text-stroke`).
- Calibrator rebuilt as **three steps**: 1 text size · 2 blur-size slider + sharpening level ·
  3 doubled letters + spacing. Large-radius previews use a padded filter region with an opaque
  backdrop to avoid edge artefacts.
- `simulateDefocus()` now defaults to a realistic σ = 2.5 px (≈ +2.00 D). The demo offers
  +1 / +2 / +3 presets.
- `filterPrimitives()`, `FilterRegion`, and the `ImageCompensator` `pixelRatio` option.

### Changed
- EF1 codes gain an optional 4th segment (`blurRadius × 100`), e.g. `EF1.nm211.100.150.250`.
  0.1 codes still decode (the radius defaults to 3).
- Calibrator message keys: `step1Instruction` and `step2Instruction` are replaced by
  `sizeInstruction`, `sharpnessInstruction` and `ghostInstruction` (plus `sizeGroupLabel`,
  `sizeOption`, `radiusLabel` and `radiusHint`).
- `blurRadius: 0` keeps the 0.1 behaviour (3×3 kernels).

### Known limitations
- The React Native wizard still has two steps (no size or blur-size step yet).

## [0.1.0] - 2026-11-13

### Added
- `@eyesfree/core`: `VisionProfile` model with validation, normalisation and migration of prototype profiles; EF1 profile code; isotropic and any-angle directional kernels; ghost-cancelling shadows; `createRenderPlan()`; self-contained pixel pipeline.
- `@eyesfree/web`: `EyesFree` engine (apply / update / enable / disable / toggle / suspend / reset / subscribe / share), SVG filter renderer with tone-mapped headroom, filter scopes (`root`, `opt-in`, `none`), surface modes (`tone`, `palette`, `both`), storage adapters, URL hand-off, `BroadcastChannel` sync, `ImageCompensator` Web Worker with main-thread fallback, preview and defocus-simulation helpers.
- `@eyesfree/calibrator`: `<eyesfree-calibrator>` Web Component (two-step wizard, WAI-ARIA radio groups, keyboard navigation, en / pt-BR / es), `openCalibratorDialog()`.
- `@eyesfree/react`: `EyesFreeProvider`, `useEyesFree`, `useEyesFreePlan`, `EyesFreeCalibrator`.
- `@eyesfree/react-native`: provider, hooks, `EyesFreeText`, `EyesFreeSurface`, native calibrator.
- `@eyesfree/browser`: IIFE and ESM bundles, static worker and CSS, `mount()`, zero-code auto-init.
- Demo app, JSON Schema, architecture diagram and documentation.

Based on the original Portuguese prototype ([docs/history](docs/history/original-spec-pt-BR.md)).
