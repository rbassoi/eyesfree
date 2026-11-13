# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

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
