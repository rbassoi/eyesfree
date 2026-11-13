# `@eyesfree/calibrator` API

`<eyesfree-calibrator>` is the two-step perceptual calibration wizard as a standard Web Component. It works in any framework or none.

```bash
npm install @eyesfree/calibrator
```

```ts
import { defineCalibrator } from '@eyesfree/calibrator';
defineCalibrator();                       // or: import '@eyesfree/calibrator/define';
```

```html
<eyesfree-calibrator locale="pt-BR"></eyesfree-calibrator>
```

## Attributes

| Attribute | Description |
|---|---|
| `locale` | `en`, `pt-BR`, `pt`, `es`, or one you registered. Falls back to `<html lang>`, then `en`. |
| `sample-letters` | Step-1 sample (default `E A O`). |
| `sample-text` | Step-2 sentence (default "Payment of $158.90 confirmed"). Use a sentence typical of your app. |
| `hide-cancel` | Hides the Cancel button on step 1. |
| `nonce` | CSP nonce for the injected stylesheet. |

## Properties

| Property | Type | Description |
|---|---|---|
| `engine` | `EyesFree \| null` | When set, *Apply* calls `engine.apply(profile)` and `start()` suspends the engine during the session. |
| `autoApply` | `boolean` (true) | |
| `suspendEngine` | `boolean` (true) | |
| `messages` | `Partial<CalibratorMessages>` | Overrides merged over the locale. |
| `profile` | `VisionProfile` | Current draft (get or set). |
| `step` | `1 \| 2` | Current step (get or set). |

## Methods

| Method | Description |
|---|---|
| `start(profile?)` | Restarts at step 1 from `profile` or the engine's current profile, and suspends the engine. |
| `goTo(step)` | |
| `complete()` | Same as pressing *Apply*: resumes the engine, applies, emits `eyesfree-complete`. |
| `cancel()` | Resumes the engine and emits `eyesfree-cancel`. |

## Events

All events bubble and are `composed`.

| Event | `detail` |
|---|---|
| `eyesfree-change` | `{ profile, step }`, fired on every selection |
| `eyesfree-step` | `{ step }` |
| `eyesfree-complete` | `{ profile }` |
| `eyesfree-cancel` | `{}` |

## Dialog helper

```ts
import { openCalibratorDialog } from '@eyesfree/calibrator';

const { result, close, element } = openCalibratorDialog({ engine, locale: 'es' });
const profile = await result;   // VisionProfile, or null when cancelled / dismissed with Esc
```

The helper uses a native modal `<dialog>`, which provides focus trapping, Esc to close and top-layer rendering, so the wizard is never affected by the compensated root.

## Theming

```css
eyesfree-calibrator {
  --efc-accent: #6d28d9;
  --efc-accent-contrast: #fff;
  --efc-confirm: #047857;
  --efc-radius: 12px;
  --efc-font: "Atkinson Hyperlegible", system-ui, sans-serif;
  --efc-sample-bg: #e4e7ec;   /* keep light: halos need headroom */
}
```

The component renders into light DOM, on purpose, so SVG filter references resolve in every browser. You can therefore also target its internal classes (`.efc-card`, `.efc-btn-primary`, …) from your own stylesheet.

## i18n

```ts
import { registerLocale, en } from '@eyesfree/calibrator';

registerLocale('fr', {
  ...en,
  title: 'Lire sans lunettes',
  stepIndicator: 'Étape {current} sur {total}',
  next: 'Continuer',
  // …
});
```

Exports: `en`, `ptBR`, `es`, `LOCALES`, `registerLocale`, `resolveLocale`, `mergeMessages`, `formatStep`, `CalibratorMessages`.

## Accessibility

- Options are WAI-ARIA `radiogroup`/`radio` with roving `tabindex`. Arrow keys, Home and End select.
- The step indicator is an `aria-live` region. Focus moves to the instruction on each step change.
- Touch targets are at least 56 px, base text is about 17 px, and the layout works at 320 px width.
- Sample previews are `aria-hidden`, so screen readers announce the option labels instead of the distorted sample text.
