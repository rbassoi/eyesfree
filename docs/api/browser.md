# `@eyesfree/browser` API

Everything (core, web and calibrator) in one file, for `<script>` tags, CMSs, WebViews and prototypes.

| File | Format |
|---|---|
| `dist/eyesfree.min.js` | IIFE, global **`eyesfree`** (about 15 kB gzipped) |
| `dist/eyesfree.js` / `dist/eyesfree.esm.min.js` | ES modules |
| `dist/eyesfree.worker.js` | Static worker for strict CSP (`workerUrl`) |
| `dist/eyesfree.css` | Static stylesheet for strict CSP (`injectStyles: false`) |

CDN: `https://unpkg.com/@eyesfree/browser/dist/eyesfree.min.js` or `https://cdn.jsdelivr.net/npm/@eyesfree/browser/dist/eyesfree.min.js`. Pin a version in production, for example `@eyesfree/browser@0.1.0`.

## Zero-code mode

```html
<script src=".../eyesfree.min.js" data-eyesfree-auto
        data-root="#app" data-locale="pt-BR" data-scope="root" data-storage-key="eyesfree:profile"></script>

<button data-eyesfree-open>👓 Sem óculos?</button>
<button data-eyesfree-toggle>Ligar / desligar</button>
```

The instance is exposed as `window.eyesfreeInstance` (`{ engine, open, destroy }`).

## `eyesfree.mount(options?)`

Takes every `EyesFree` option plus:

| Option | Default | Description |
|---|---|---|
| `locale` | | Dialog locale. |
| `openSelector` | `[data-eyesfree-open]` | Elements that open the wizard; `false` disables. |
| `toggleSelector` | `[data-eyesfree-toggle]` | Elements that toggle compensation; `false` disables. |

It returns `{ engine, open(), destroy() }`.

Every export of [core](core.md), [web](web.md) and [calibrator](calibrator.md) is also available on the global, for example `eyesfree.encodeProfile`, `eyesfree.ImageCompensator` and `eyesfree.openCalibratorDialog`.
