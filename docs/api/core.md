# `@eyesfree/core` API

Pure TypeScript with no DOM and zero dependencies. Safe in browsers, Node, Deno, Bun, Web Workers and React Native.

```bash
npm install @eyesfree/core
```

## Profiles

| Function | Description |
|---|---|
| `createProfile(overrides?)` | Defaults + overrides, normalised and stamped with `updatedAt`. |
| `normalizeProfile(input)` | Best-effort repair of any input: fills defaults, clamps numbers, migrates prototype profiles. Never throws. |
| `validateProfile(input)` | Strict validation → `{ valid, errors[] }`. |
| `isVisionProfile(input)` | Type guard (strict). |
| `updateProfile(profile, patch)` | Returns a new, normalised, re-stamped profile. |
| `profilesEqual(a, b)` | Compares profiles, ignoring `updatedAt`. |
| `isGhostAxis` / `isSharpnessLevel` / `isCrowdingLevel` | Primitive guards. |

```ts
import { createProfile, validateProfile } from '@eyesfree/core';

const p = createProfile({ ghostAxis: 'vertical', sharpness: 'strong' });
validateProfile(p); // { valid: true, errors: [] }
```

## Codec

| Function | Description |
|---|---|
| `encodeProfile(profile)` | → `'EF1.vs211.100.100'` |
| `decodeProfile(code)` | → `VisionProfile` or `null` (strict) |
| `serializeProfile(profile)` | → JSON string |
| `parseProfile(raw)` | Accepts JSON, an EF1 code, an object, `null` or `''` → `VisionProfile` or `null` |
| `PROFILE_CODE_PREFIX` | `'EF1'` |

## Render plan

| Function | Description |
|---|---|
| `createRenderPlan(profile \| partial \| null)` | Platform-neutral plan. See [profile-spec § 3](../profile-spec.md#3-deriving-the-renderplan). |
| `ghostKernel(axis, intensity?)` | Directional kernel for an axis, or `null`. |
| `INACTIVE_PLAN` | Frozen plan that renders nothing. |

```ts
const plan = createRenderPlan({ ghostAxis: 'horizontal', sharpness: 'medium' });
plan.kernels;        // [directional 0°, isotropic k=0.95]
plan.textShadowCss;  // '-1.3px 0px 0px rgba(255,255,255,0.95), 1.1px 0px 0px rgba(0,0,0,0.45)'
```

## Kernels & shadows

| Function | Description |
|---|---|
| `deconvolutionKernel(k, d = 0)` | Isotropic high-boost kernel (sum = 1). |
| `directionalKernel(angleDeg, k)` | 1-D high-boost kernel at any angle. |
| `identityKernel()` | No-op kernel. |
| `kernelSum(kernel)` / `kernelToString(kernel)` | Helpers (the string form suits `feConvolveMatrix@kernelMatrix`). |
| `ghostShadows(axis, intensity?)` | `ShadowSpec[]` for an axis. |
| `directionalShadows(angleDeg, intensity?)` / `outlineShadows(intensity?)` | Low-level shadow builders. |
| `shadowsToCss(shadows)` / `rgbaToCss(rgba)` | CSS formatting. |

## Pixels

| Function | Description |
|---|---|
| `compensatePixels(rgba, width, height, plan)` | Full raster pipeline (tone → kernels). Returns a new buffer. |
| `convolveRGBA(rgba, width, height, kernel9)` | One 3×3 convolution. Alpha preserved, edges clamped. **Self-contained.** |
| `toneMapRGBA(rgba, slope, intercept)` | In-place linear tone mapping. **Self-contained.** |

Use these in Node to pre-process images server-side (for example with `sharp` raw buffers), or in your own worker.

## Constants

`DEFAULT_PROFILE`, `GHOST_AXES`, `SHARPNESS_LEVELS`, `CROWDING_LEVELS`, `SHARPNESS_PRESETS`, `DIRECTIONAL_STRENGTH`, `GHOST_AXIS_ANGLE`, `GHOST_SHADOW`, `CROWDING_SPACING`, `SHARPNESS_WEIGHT_DELTA`, `SURFACE_TONE`, `SURFACE_PALETTE`, `INTENSITY_RANGE`, `FONT_SCALE_RANGE`, `PROFILE_VERSION`, `VERSION`.

## Types

`VisionProfile`, `GhostAxis`, `SharpnessLevel`, `CrowdingLevel`, `RenderPlan`, `ConvolutionKernel`, `ShadowSpec`, `ToneMapping`, `SurfacePalette`, `ValidationResult`.
