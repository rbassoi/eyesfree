# Profile & render-plan specification (v1)

This is the language-neutral contract that lets a profile created in one app (say, a React Native banking app) be rendered identically in another (its WebView help centre, a Flutter health app, a kiosk). Any implementation that follows this document is EyesFree-compatible.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

## 1. `VisionProfile`

JSON Schema: [`spec/vision-profile.schema.json`](../spec/vision-profile.schema.json)

| Field | Type | Range / values | Default | Meaning |
|---|---|---|---|---|
| `version` | integer | `1` | `1` | Schema version |
| `enabled` | boolean | | `true` | Whether compensation is applied |
| `ghostAxis` | string | `none` `horizontal` `vertical` `diagonal45` `diagonal135` `outline` | `none` | Step-3 choice |
| `sharpness` | string | `none` `mild` `medium` `strong` | `medium` | Step-2 choice (strength) |
| `blurRadius` | number | `0`–`12` | `3` | Step-2 choice: blur size, Gaussian σ in CSS px. `0` = legacy 3×3 kernel |
| `crowding` | integer | `0`–`3` | `2` | Spacing level |
| `intensity` | number | `0.25`–`2` | `1` | Global strength multiplier |
| `surfaceCompensation` | boolean | | `true` | Luminance headroom |
| `fontScale` | number | `1`–`4` | `1` | Step-2 choice: text magnification |
| `viewingDistance` | number | `0`–`300` | `0` | Step-1 choice: distance (cm) where the user sees sharply without glasses. `0` = unknown / normal |
| `updatedAt` | string | ISO-8601 | | Informational |

**Normalisation.** Readers SHOULD accept partial or slightly invalid input by replacing invalid fields with the defaults and clamping numbers into range (`normalizeProfile`). Writers MUST emit valid profiles.

**Legacy input.** Readers SHOULD migrate profiles saved by the original prototype:
`ghostAxis: horiz→horizontal, vert→vertical, diag1→diagonal135, diag2→diagonal45, double→outline`, `sharpnessLevel→sharpness`, `crowdingLevel→crowding`.

## 2. EF1 profile code

A compact, URL-safe text form for deep links, QR codes, push payloads and native↔WebView hand-off.

```
EF1.<axis><sharpness><crowding><surface><enabled>.<intensity×100>.<fontScale×100>[.<blurRadius×100>[.<viewingDistance>]]
```

| Position | Values |
|---|---|
| axis | `n` none · `h` horizontal · `v` vertical · `a` diagonal45 · `b` diagonal135 · `o` outline |
| sharpness | `n` none · `l` mild · `m` medium · `s` strong |
| crowding | `0`–`3` |
| surface | `1` on · `0` off |
| enabled | `1` on · `0` off |
| intensity | integer, `25`–`200` |
| fontScale | integer, `100`–`400` |
| blurRadius | integer, `0`–`1200`. **Optional** when decoding (added in 0.2; absent ⇒ default 3 px). Encoders MUST emit it. |
| viewingDistance | integer cm, `0`–`300`. **Optional** (added in 0.3; absent ⇒ 0). Encoders MUST emit it. |

Regular expression: `^EF1\.([nhvabo])([nlms])([0-3])([01])([01])\.(\d{1,3})\.(\d{1,3})(?:\.(\d{1,4})(?:\.(\d{1,3}))?)?$`

Examples:

| Code | Meaning |
|---|---|
| `EF1.nm211.100.100.300` | default: no ghosting, medium sharpness, blur 3 px, medium spacing |
| `EF1.hs311.125.150.450` | horizontal ghosting, strong, wide spacing, intensity 1.25, text 150 %, blur 4.5 px |
| `EF1.vl110.100.140.0` | vertical, mild (legacy 3×3), soft spacing, **disabled**, text 140 % |

Decoders MUST reject codes that do not match the regex or whose numbers are out of range. Web apps read the code from the `eyesfree` query or hash parameter by default (`https://app.example/?eyesfree=EF1.nm211.100.150.300`).

## 3. Deriving the `RenderPlan`

Given a normalised profile `p`:

1. If `p.enabled` is false, the plan is **inactive**: no tone, no kernels, no shadows, zero spacing, `fontScale = 1`.
2. **Kernels** (in this order):
   1. If `ghostAxis` ∈ {horizontal, vertical, diagonal45, diagonal135}: `directionalKernel(angle, s × intensity)` with angle 0/90/45/135 and `s = 1.1` for 0°/90° or `1.0` for diagonals.
   2. If `sharpness ≠ none` **and `blurRadius = 0`**: `deconvolutionKernel(k × intensity, d × intensity)` with (k, d) = mild (0.55, 0) · medium (0.95, 0) · strong (1.15, 0.25).
   - **Unsharp:** if `sharpness ≠ none` and `blurRadius > 0`: `{ sigma: blurRadius, amount: a × intensity }` with a = mild 0.6 · medium 1.0 · strong 1.5, applied **after** the kernels as `out = in + amount × (in − G_sigma ⊛ in)`. `sigma` is in CSS px (multiply by the device pixel ratio for raster buffers).
   - **textStrokePx:** none 0 · mild 0.15 · medium 0.3 · strong 0.45, times `intensity`.
3. **Shadows:** from `ghostAxis` (see § 5), with offsets multiplied by `intensity`.
4. **Tone:** `{ slope: 0.86, intercept: 0.04 }` if `surfaceCompensation` and (kernels, unsharp or shadows are non-empty); otherwise `null`.
5. **Spacing:** crowding 0→(0.010, 0.02) · 1→(0.040, 0.05) · 2→(0.065, 0.08) · 3→(0.095, 0.12) em (letter, word).
6. **fontWeightDelta:** none 0 · mild 100 · medium 200 · strong 300 (for renderers without convolution).
7. **surface palette:** `{ background #E4E7EC, surface #EAECEF, border #CBD5E1, text #0F172A }` if `surfaceCompensation`.

Weights are rounded to 4 decimals. `-0` is normalised to `0`.

## 4. Kernels

### Isotropic

```
deconvolutionKernel(k, d) = [ -d, -k, -d,
                              -k, 1+4k+4d, -k,
                              -d, -k, -d ]
```

### Directional (any angle θ, screen coordinates with y pointing down)

```
v  = (cos θ, −sin θ)
p  = v / max(|v.x|, |v.y|)          // project onto the 3×3 border
w[centre] = 1 + 2k
splat(+p, −k); splat(−p, −k)        // bilinear distribution into the 3×3 grid
```

Reference values (must match exactly):

| θ | k | matrix |
|---|---|---|
| 0° | 1.1 | `0 0 0 -1.1 3.2 -1.1 0 0 0` |
| 90° | 1.1 | `0 -1.1 0 0 3.2 0 0 -1.1 0` |
| 45° | 1.0 | `0 0 -1 0 3 0 -1 0 0` |
| 135° | 1.0 | `-1 0 0 0 3 0 0 0 -1` |

### Applying a kernel to pixels

Apply it to R, G and B independently in **sRGB** (gamma-encoded) space. Keep alpha unchanged. Clamp edges by repeating the border pixel, and clamp results to [0, 255].

## 5. Shadows

For directional axes, orient the unit vector `u` so that it points down (or right, for horizontal axes). Then:

- light shadow at `−u × L`, colour `rgba(255,255,255,0.95)`
- dark shadow at `+u × D`, colour `rgba(0,0,0,0.45)`

where for orthogonal axes `L = 1.3`, `D = 1.1` (px), and for exact diagonals each component is `±1.2` / `±1.0` px. `outline` produces four light shadows at `(±1.1, ±1.1)` with alpha 1. Platforms that support a single shadow SHOULD use the first (light) one.

Reference CSS:

| axis | text-shadow |
|---|---|
| horizontal | `-1.3px 0px 0px rgba(255,255,255,0.95), 1.1px 0px 0px rgba(0,0,0,0.45)` |
| vertical | `0px -1.3px 0px rgba(255,255,255,0.95), 0px 1.1px 0px rgba(0,0,0,0.45)` |
| diagonal135 | `-1.2px -1.2px 0px rgba(255,255,255,0.95), 1px 1px 0px rgba(0,0,0,0.45)` |
| diagonal45 | `1.2px -1.2px 0px rgba(255,255,255,0.95), -1px 1px 0px rgba(0,0,0,0.45)` |

## 6. Storage

Implementations SHOULD store the profile under the key `eyesfree:profile` as JSON (or as an EF1 code). That way a WebView and its native host can share one store when they share storage.

## Porting checklist

Run these checks to confirm a port in another language (Dart, Swift, Kotlin, C#, Python…) matches the reference:

- [ ] `normalizeProfile` fills defaults, clamps ranges and migrates legacy names
- [ ] EF1 `encode(decode(x)) == x` for every valid code; invalid codes are rejected
- [ ] Kernels match the reference table above exactly
- [ ] Shadows match the reference CSS above
- [ ] Pipeline order: tone → directional → isotropic (legacy) → unsharp; text: magnification → stroke / shadows / spacing
- [ ] Pixel pipeline output equals `compensatePixels` from `@eyesfree/core` on the test image used in `packages/core/test` (±1 per channel for float differences)
- [ ] The UI offers the three steps (smallest comfortable size · blur size + easiest to read · least doubled) and a way to turn compensation off

Please open a PR adding your port to [docs/integrations](integrations/README.md).
