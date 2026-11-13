# EyesFree 👓

**Read the screen without your glasses.** EyesFree is an open-source accessibility toolkit that pre-compensates on-screen text for people with presbyopia, mild myopia or astigmatism who don't have their glasses at hand. It needs no prescription: a short visual calibration does the job.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Zero runtime dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)
![Bundle](https://img.shields.io/badge/browser%20bundle-23%20kB%20gz-informational)

**▶ [Live demo](https://rbassoi.github.io/eyesfree/)**

<p align="center">
  <img src="docs/assets/demo-calibration.png" alt="Step 2 of the EyesFree calibration, magnified to be readable from 1 m: candidate text sizes shown at their real size" width="49%">
  <img src="docs/assets/demo-active.png" alt="A banking app with EyesFree compensation applied: sharpened text, wider spacing and a low-glare background" width="49%">
</p>

> ⚠️ **EyesFree is a reading aid, not a medical device.** It does not diagnose, treat or replace glasses, contact lenses or an eye exam. See [Scientific basis & limitations](docs/how-it-works.md#limitations).

---

## Why

Older adults lose or forget their glasses constantly, yet they still need to confirm a bank transfer, read a medication reminder or answer a message. Large-text modes help, but they break layouts and don't fix *blur* or *doubled letters*.

EyesFree takes a different route, **perceptual calibration**:

1. **Step 1 – distance.** Without reading glasses, a presbyopic eye still focuses sharply, only *farther away*. The user moves back until large sample letters look **sharp** and says roughly how far they are (for example 1 m).
2. **Step 2 – size.** From there, the user taps the smallest text they can read. EyesFree suggests the magnification that restores the normal reading size (distance ÷ 40 cm, so 1 m → 250 %) and enlarges and reflows the whole app. The wizard magnifies *itself* too, so it stays readable from the chair.
3. **Optional fine-tuning.** Blur-sized pre-sharpening, a stroke boost, ghost cancellation for astigmatism and anti-crowding spacing, for people who must stay close to the screen.
4. **Apply.** The choice is stored as a tiny profile and applied to the whole app.

> **Why distance first?** No software can make text optically sharp for an eye that cannot focus at that distance, because the blur happens inside the eye. Distance + magnification gives **truly sharp** text. It was validated by a +2.50 reading-glasses user, who saw sharp text at 1 m with 250 % zoom, exactly the suggested value. Sharpening filters only make blurred text *more legible*.

No diopters, no medical data, no account: just "which one looks better?".

<p align="center"><img src="docs/assets/simulated-comparison.png" alt="The same screen seen through a simulated +2.00 uncorrected eye: without compensation, with the v0.1 3x3 kernel (no visible difference), and with v0.2 (150% text and blur-sized sharpening), where the text is readable" width="100%"></p>
<p align="center"><sub>Simulated +2.00 D eye seen from reading distance (σ = 2.5 px). Left: no compensation · middle: v0.1 3×3 kernel (no visible gain) · right: v0.2 size + sharpening (more legible, but still blurred: sitting farther away is what makes it sharp).</sub></p>

## Features

- 🧮 **Framework-agnostic core**: pure TypeScript with no DOM and zero dependencies. It runs in browsers, Node, Workers and React Native, and serves as a reference for other languages.
- 🌐 **Drop-in web engine**: one call applies compensation to any page, PWA, WebView, Electron, Capacitor or Ionic app.
- 🧩 **`<eyesfree-calibrator>` Web Component**: works with React, Vue, Angular, Svelte, Solid, Lit or plain HTML. Accessible (WAI-ARIA radio groups, keyboard navigation, 56 px targets) and localised (English, Português, Español, plus your own).
- ⚛️ **React** and 📱 **React Native / Expo** bindings.
- 📷 **Camera distance guard** (opt-in, on-device): measures how far you sit, picks the distance in the calibrator and warns "move back a little" when you get too close. Works for sites on a computer (webcam + MediaPipe) and apps on a phone (React Native / native helpers).
- 🧵 **Web Worker image compensator** for canvas, charts, maps and rendered PDFs. It produces bit-identical output to the main-thread fallback.
- 🔗 **Portable profile code** (`EF1.nn211.100.250.300.100`): hand a profile from a native shell to a WebView, a QR code, a deep link or a support agent.
- 💾 **Pluggable storage**: localStorage, AsyncStorage, IndexedDB or your own backend API.
- 🔄 **Cross-tab sync**, **SSR-safe**, **CSP-friendly** (static worker and CSS files, nonce support).
- 📐 **Open spec** with a JSON Schema, so Flutter, Swift and Kotlin apps can interoperate.

## Quick start

### 1 · Any website: one script tag

```html
<script src="https://unpkg.com/@eyesfree/browser/dist/eyesfree.min.js"
        data-eyesfree-auto data-root="#app" data-locale="en"></script>

<button data-eyesfree-open>👓 No glasses?</button>
<button data-eyesfree-toggle>On / off</button>
```

That's it: the button opens the calibration dialog, the result is saved and re-applied on every visit.

### 2 · npm (any framework)

```bash
npm install @eyesfree/web @eyesfree/calibrator
```

```ts
import { createEyesFree } from '@eyesfree/web';
import { openCalibratorDialog } from '@eyesfree/calibrator';

const eyesfree = createEyesFree({ root: '#app' });   // restores the saved profile

glassesButton.onclick = () => openCalibratorDialog({ engine: eyesfree });
```

### 3 · React

```tsx
import { EyesFreeProvider, EyesFreeCalibrator, useEyesFree } from '@eyesfree/react';

<EyesFreeProvider options={{ root: '#root' }}>
  <App />
</EyesFreeProvider>;

function VisionSettings() {
  const { active, toggle } = useEyesFree();
  return (
    <>
      <button onClick={toggle}>{active ? 'Turn off' : 'Turn on'}</button>
      <EyesFreeCalibrator locale="en" onComplete={() => navigate('/')} />
    </>
  );
}
```

### 4 · React Native / Expo

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EyesFreeProvider, EyesFreeText, EyesFreeSurface, EyesFreeCalibrator } from '@eyesfree/react-native';

<EyesFreeProvider storage={AsyncStorage}>
  <EyesFreeSurface style={{ flex: 1 }}>
    <EyesFreeText style={{ fontSize: 18 }}>Balance: $3,482.65</EyesFreeText>
  </EyesFreeSurface>
</EyesFreeProvider>;
```

More recipes, covering Vue, Angular, Svelte, Next.js, Capacitor, Flutter, iOS, Android and backend sync, are in **[docs/integrations](docs/integrations/README.md)**.

## Packages

| Package | What it is | Use it when |
|---|---|---|
| [`@eyesfree/core`](packages/core) | Profile model, kernels, render plan, codec, pixel pipeline. Pure TS, no DOM. | You build an adapter, a port, or process images on a server or worker. |
| [`@eyesfree/web`](packages/web) | DOM engine, storage adapters, SVG filters, `ImageCompensator` (Web Worker). | Any web-based UI. |
| [`@eyesfree/calibrator`](packages/calibrator) | `<eyesfree-calibrator>` Web Component, dialog helper, i18n. | You want the ready-made wizard. |
| [`@eyesfree/react`](packages/react) | `EyesFreeProvider`, `useEyesFree`, `EyesFreeCalibrator`. | React web apps. |
| [`@eyesfree/react-native`](packages/react-native) | Provider, `EyesFreeText`, `EyesFreeSurface`, native wizard. | React Native / Expo. |
| [`@eyesfree/distance`](packages/distance) | Camera distance monitor (MediaPipe, lazy-loaded), "move back" guard, calibrator integration. | You want measured distance and reminders. |
| [`@eyesfree/browser`](packages/browser) | Everything in one file (IIFE global `eyesfree` + ESM), static worker and CSS. | `<script>` tag, CMS, no build step. |

## Architecture

<p align="center"><img src="docs/assets/architecture.svg" alt="EyesFree architecture: host apps → integration packages → web runtime → pure core; runtime data flow from calibration to profile to render plan to DOM, text, raster and native outputs" width="100%"></p>

A user choice becomes a **`VisionProfile`** (what the user picked). `createRenderPlan()` turns it into a platform-neutral **`RenderPlan`** (tone mapping, kernels, shadows, spacing), and each adapter renders that plan in its own medium. Read the full design in **[docs/architecture.md](docs/architecture.md)**.

## Documentation

| | |
|---|---|
| 📐 [Architecture](docs/architecture.md) | Layers, data flow, rendering pipeline, design decisions |
| 🔬 [How it works](docs/how-it-works.md) | The optics and maths, tuning, limitations |
| 📄 [Profile & render-plan spec](docs/profile-spec.md) | Data contracts, EF1 code, JSON Schema, porting guide |
| 🔌 [Integrations](docs/integrations/README.md) | Step-by-step recipes for every platform |
| 📷 [Camera distance](docs/integrations/distance.md) | Computer vs phone, privacy, accuracy, React Native / iOS / Android recipes |
| 📚 API reference | [core](docs/api/core.md) · [web](docs/api/web.md) · [calibrator](docs/api/calibrator.md) · [distance](docs/api/distance.md) · [react](docs/api/react.md) · [react-native](docs/api/react-native.md) · [browser](docs/api/browser.md) |
| 🤝 [Contributing](CONTRIBUTING.md) | Dev setup, conventions, release process |

## Run it locally

```bash
git clone https://github.com/rbassoi/eyesfree.git
cd eyesfree
npm install
npm run demo        # builds everything and serves http://localhost:5173
npm test            # 68 tests: core maths, engine, worker, Web Component, React, React Native
```

In the demo, press **Simulate eye** to blur the phone the way an uncorrected eye would. Then calibrate and compare.

## Roadmap

- [ ] Dark-mode tuned presets (light-on-dark text)
- [ ] Optional distance estimation via front camera (opt-in, on-device)
- [ ] `@shopify/react-native-skia` GPU convolution component
- [ ] Published Flutter package (`eyesfree` on pub.dev) based on the [reference port](docs/integrations/flutter.md)
- [ ] User studies with optometry partners to refine presets ([help wanted](CONTRIBUTING.md))

## License and attribution

EyesFree is released under the **[Apache License 2.0](LICENSE)**. You may use it in commercial and non-commercial products, modify it and redistribute it. Redistributions **must keep the [NOTICE](NOTICE) file**, which credits the original project. Please also mention it in your documentation or "About" screen, for example:

> Optical compensation powered by [EyesFree](https://github.com/rbassoi/eyesfree).

Created by Ricardo and [contributors](AUTHORS).
