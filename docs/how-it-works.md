# How it works

EyesFree combines three techniques that a normal LCD/OLED screen can apply *before* light reaches the eye: inverse blurring, directional ghost cancellation and anti-crowding spacing. This page explains each one, how the presets were chosen, and, just as importantly, what the approach **cannot** do.

## 1. The problem in optical terms

Without correction, an eye with refractive error projects every point of the screen as a small blurred disc on the retina, its *point-spread function* (PSF):

- **Presbyopia / myopia / hyperopia (defocus):** the PSF is roughly a symmetric Gaussian. Glyph edges turn into grey ramps, and thin strokes lose contrast first.
- **Astigmatism:** the PSF is elongated along one axis. Users describe this as *"the letters are doubled"* or *"there is a shadow next to each letter"*.
- **Crowding:** blurred neighbouring glyphs overlap on the retina, which makes words harder to read than isolated letters.

The image on the retina is approximately `retina = screen ⊛ PSF`. EyesFree tries to display `screen' ≈ screen ⊛ PSF⁻¹`, so that `screen' ⊛ PSF` comes closer to the sharp original.

### How big is the blur?

With defocus `D` (dioptres) and pupil diameter `p`, the blur disc subtends about `p × D` radians. At reading distance `d`, it covers `p × D × d` on the screen:

| Situation | Blur disc on screen | In CSS px (≈ 0.26 mm desktop / 0.16 mm phone) |
|---|---|---|
| +1.00 D, 4 mm pupil, 30 cm | ≈ 1.2 mm | ≈ 5 px desktop · 8 px phone |
| +2.00 D, 4 mm pupil, 30 cm | ≈ 2.4 mm | ≈ 9 px desktop · 15 px phone |
| +3.00 D, 4 mm pupil, 35 cm | ≈ 4.2 mm | ≈ 16 px desktop · 26 px phone |

A Gaussian with σ ≈ diameter / 4 is a reasonable stand-in, so σ ≈ 1–6 CSS px covers most readers. This is why the calibrator asks the user to *size* the blur with a slider.

> **Lesson from 0.1.** The first release only used 3×3 kernels, which act on a ~1-pixel neighbourhood. That is an order of magnitude smaller than the blur above, and field testing confirmed it made no perceptible difference. Since 0.2, the pre-sharpening radius is matched to the user's blur, and magnification (the strongest lever) is applied for real.
>
> ![Simulated +2.00 D eye: no compensation, v0.1, v0.2](assets/simulated-comparison.png)

## 2. The approach that gives truly sharp text: distance + magnification

Presbyopia reduces how much the eye can *add* focusing power for near objects. A reader who needs **+2.50** reading glasses (prescribed for ≈ 40 cm, i.e. 2.5 D of demand) has little accommodation left, so without glasses their eye focuses sharply only from roughly **1 m** onwards (if their distance vision is good). At that distance the image on the retina is genuinely sharp. It is only small.

Magnifying by `distance / 40 cm` restores the normal angular size of the text:

| Sharp from | Suggested magnification |
|---|---|
| 50 cm | 125 % |
| 70 cm | 175 % |
| 1 m | **250 %** |
| 1.3 m | 325 % |
| ≥ 1.6 m | 400 % (maximum) |

This was confirmed by a +2.50 user, who read sharply at 1 m with 250 %. The calibrator's first two steps implement exactly this (`viewingDistance`, `fontScale`, `suggestFontScale()`). The sharpening techniques below are for people who must stay close to the screen. They improve legibility but cannot make the text sharp.

**Computer vs phone.** On a computer, sitting 1–1.5 m away is easy, so text can be made truly sharp. A phone is limited by arm length (≈ 50–65 cm): that is sharp only for milder presbyopia, and with stronger reading prescriptions a phone gives *more legible* rather than sharp text. Calibrate each device separately; profiles are stored per device. The optional camera guard ([guide](integrations/distance.md)) measures the distance and reminds users to stay where they see sharply.

For **myopia** the situation is reversed: myopes usually see well up close without glasses, so bringing the screen nearer helps. Nothing on this page helps when the eye cannot focus at any practical distance; only lenses do.

## 2a. Technique 0: magnification

Enlarging text is by far the most effective screen-side aid. A blur of fixed size hurts small glyphs much more than large ones, because the stroke width and the gaps between letters grow while the blur stays the same. Step 1 asks for the *smallest comfortable* size (100–200 %). On the web it is applied with CSS `zoom` on the root's children, so the layout reflows like browser zoom while the sharpening filter on the root keeps operating in true screen pixels.

## 2b. Technique A1: large-radius pre-sharpening (step 2)

```
out = in + a × (in − G_σ ⊛ in)          (unsharp mask, σ = the user's blur size)
```

This is the first-order term of the inverse of a Gaussian blur. Each glyph gets a dark inner band and a bright outer band whose *width matches the user's blur*, so after the eye's blur the edge contrast is partially restored. `a` is 0.6 / 1.0 / 1.5 for mild / medium / strong, times `intensity`. On the web it is an `feGaussianBlur` + `feComposite arithmetic` pair, which is GPU-accelerated and expressed in CSS px, so it is independent of device pixel ratio. A light stroke thickening (0.15–0.45 px) helps thin strokes survive the blur.

## 2c. Technique A2: legacy 3×3 deconvolution (`blurRadius: 0`)

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

These ranges come from the original prototype and are **not supported by field testing**: a 3×3 kernel is far smaller than real defocus blur (see above). The legacy kernels remain available with `blurRadius: 0` for compatibility and for very mild cases.

## 3. Technique B: directional ghost cancellation (step 3)

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

The six step-3 cards show the same letters with each compensation. The user picks the one that looks **least doubled**, and the chosen direction is the one that best opposes their astigmatic axis.

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
tone mapping → directional kernel (step 3) → large-radius unsharp mask (step 2; or legacy 3×3 kernel)
text: magnification (step 1) → stroke + shadows + spacing
```

All adapters must respect this order so that profiles look the same everywhere.

## Limitations

Please read this section before you promote EyesFree to end users.

- **It is not a medical device.** It cannot diagnose or treat any condition and does not replace glasses, contact lenses or an eye exam. Sudden changes in vision need a professional.
- **The improvement is partial, and most of it comes from magnification.** Screen-side pre-sharpening cannot fully invert optical blur, because displays lack the dynamic range and are not light-field displays. Expect *easier* reading of text and numbers, not 20/20 vision. Sharpening adds a modest extra benefit on top of a larger text size, mostly for mild-to-moderate errors (up to about 2.5–3 D) at a fixed reading distance.
- **Distance matters.** Presets assume phone distance (30–40 cm). Recalibrate when switching to a tablet or laptop.
- **Pixel density.** The large-radius filter is expressed in CSS px, so it behaves the same on any DPI. The legacy 3×3 kernels operate on device pixels and become almost invisible on high-DPI screens.
- **Images and video** inside a `root`-scoped filter are sharpened too. Use `scope: 'opt-in'` if that is undesirable.
- **Dark themes:** the presets were tuned for dark text on a light background. Light-on-dark works, but it has not been tuned yet (see the roadmap).
- **No clinical validation yet.** The presets come from informal perceptual testing. Contributions from optometrists and vision scientists are very welcome. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Further reading

- Huang, Wetzstein, Barsky & Raskar, *Eyeglasses-free Display: Towards Correcting Visual Aberrations with Computational Light Field Displays*, ACM SIGGRAPH 2014.
- Alonso & Barreto, *Pre-compensation for high-order aberrations of the human eye using on-screen image deconvolution*, IEEE EMBS 2003.
- Pelli & Tillman, *The uncrowded window of object recognition*, Nature Neuroscience 2008.
