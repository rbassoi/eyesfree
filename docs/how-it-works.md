# How it works

EyesFree combines three techniques that a normal LCD/OLED screen can apply *before* light reaches the eye: inverse blurring, directional ghost cancellation and anti-crowding spacing. This page explains each one, how the presets were chosen, and, just as importantly, what the approach **cannot** do.

## 1. The problem in optical terms

Without correction, an eye with refractive error projects every point of the screen as a small blurred disc on the retina, its *point-spread function* (PSF):

- **Presbyopia / myopia / hyperopia (defocus):** the PSF is roughly a symmetric Gaussian. Glyph edges turn into grey ramps, and thin strokes lose contrast first.
- **Astigmatism:** the PSF is elongated along one axis. Users describe this as *"the letters are doubled"* or *"there is a shadow next to each letter"*.
- **Crowding:** blurred neighbouring glyphs overlap on the retina, which makes words harder to read than isolated letters.

The image on the retina is approximately `retina = screen ⊛ PSF`. EyesFree tries to display `screen' ≈ screen ⊛ PSF⁻¹`, so that `screen' ⊛ PSF` comes closer to the sharp original.

## 2. Technique A: isotropic deconvolution (step 2)

A full inverse of a Gaussian is unstable and needs a dynamic range the display does not have. EyesFree uses a regularised first-order approximation, a **modified Laplacian high-boost kernel**:

```
        |  -d   -k    -d  |
K   =   |  -k  1+4k+4d -k |      Σ K = 1 (average brightness preserved)
        |  -d   -k    -d  |
```

Each glyph gets a **hyper-dark inner edge** and a **hyper-bright outer edge**. After the eye's blur, these overshoots partially cancel the grey transition band and restore edge contrast.

| Level | `k` | `d` | Tuned for (approx.) |
|---|---|---|---|
| `mild` | 0.55 | 0 | ~ +1.00 to +1.50 D |
| `medium` | 0.95 | 0 | ~ +1.75 to +2.25 D |
| `strong` | 1.15 | 0.25 | ≥ +2.50 D |

The dioptre ranges are **indicative only**. They come from the original prototype's perceptual tuning at typical phone reading distance (30–40 cm). The user's choice in step 2 is what matters. `intensity` scales `k` and `d` linearly for fine-tuning.

## 3. Technique B: directional ghost cancellation (step 1)

For a PSF elongated along an angle θ, EyesFree combines two things:

1. **A 1-D high-boost kernel along θ**, built by `directionalKernel(θ, k)`:

   ```
   0°  (horizontal)   90° (vertical)    135° (↖↘)          45° (↗↙)
   | 0    0    0 |    | 0  -k  0 |      | -k  0   0 |      | 0   0  -k |
   | -k  1+2k  -k |   | 0 1+2k 0 |      | 0 1+2k  0 |      | 0 1+2k  0 |
   | 0    0    0 |    | 0  -k  0 |      | 0   0  -k |      | -k  0   0 |
   ```

   Any other angle is supported. The direction vector is projected onto the border of the 3×3 neighbourhood and split bilinearly between the two nearest cells.

2. **Phase-cancelling text shadows**: a light halo on one side of the ghost vector and a dark edge reinforcement on the other:

   ```
   text-shadow: (−Δx, −Δy) rgba(255,255,255,0.95),   (+Δx, +Δy) rgba(0,0,0,0.45)
   ```

   with Δ = 1.3 / 1.1 px for orthogonal axes and 1.2 / 1.0 px per component for diagonals. The `outline` option draws a four-way light halo for users who see ghosting in every direction.

The six step-1 cards show the same letters with each compensation. The user picks the one that looks **least doubled**, and the chosen direction is the one that best opposes their astigmatic axis.

## 4. Technique C: anti-crowding spacing

Extra letter and word spacing keeps the blurred halo of one glyph from landing on its neighbour:

| Level | letter-spacing | word-spacing |
|---|---|---|
| 0 Standard | 0.010 em | 0.02 em |
| 1 Soft | 0.040 em | 0.05 em |
| 2 Medium | 0.065 em | 0.08 em |
| 3 Wide | 0.095 em | 0.12 em |

The values are expressed in `em`, so they scale with each element's own font size.

## 5. Surface compensation (luminance headroom)

A display cannot show anything brighter than `#FFFFFF`. On a pure-white background, the bright half of every halo is clipped and the deconvolution loses about half its effect. EyesFree therefore compresses the luminance range first:

```
out = in × 0.86 + 0.04      →   white ≈ 0.90 (#E6E6E6),  black ≈ 0.04
```

In the web engine this is an `feComponentTransfer` primitive at the start of the filter, so no CSS changes are needed. Platforms without filters use the equivalent palette (`#E4E7EC` background, `#0F172A` text).

## 6. Order of operations

```
tone mapping → directional kernel (step 1) → isotropic kernel (step 2) → shadows + spacing (text)
```

All adapters must respect this order so that profiles look the same everywhere.

## Limitations

Please read this section before you promote EyesFree to end users.

- **It is not a medical device.** It cannot diagnose or treat any condition and does not replace glasses, contact lenses or an eye exam. Sudden changes in vision need a professional.
- **The improvement is partial.** Screen-side pre-compensation cannot fully invert optical blur, because displays lack the dynamic range and are not light-field displays. Expect *easier* reading of text and numbers, not 20/20 vision. It works best for mild-to-moderate errors (up to about 2.5–3 D) at a fixed reading distance.
- **Distance matters.** Presets assume phone distance (30–40 cm). Recalibrate when switching to a tablet or laptop.
- **Pixel density matters.** SVG kernels operate on device pixels in most browsers, so the effect is subtler on very high-DPI screens. Use `intensity` (for example 1.25–1.5) to compensate.
- **Images and video** inside a `root`-scoped filter are sharpened too. Use `scope: 'opt-in'` if that is undesirable.
- **Dark themes:** the presets were tuned for dark text on a light background. Light-on-dark works, but it has not been tuned yet (see the roadmap).
- **No clinical validation yet.** The presets come from informal perceptual testing. Contributions from optometrists and vision scientists are very welcome. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Further reading

- Huang, Wetzstein, Barsky & Raskar, *Eyeglasses-free Display: Towards Correcting Visual Aberrations with Computational Light Field Displays*, ACM SIGGRAPH 2014.
- Alonso & Barreto, *Pre-compensation for high-order aberrations of the human eye using on-screen image deconvolution*, IEEE EMBS 2003.
- Pelli & Tillman, *The uncrowded window of object recognition*, Nature Neuroscience 2008.
