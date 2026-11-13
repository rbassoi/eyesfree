# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

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
