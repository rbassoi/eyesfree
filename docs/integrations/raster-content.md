# Canvas, charts, maps & PDF viewers

CSS filters apply to DOM rendering. With `scope: 'root'` they also cover `<canvas>` and `<img>` elements inside the root, because the whole root is filtered. Use `ImageCompensator` when:

- you use `scope: 'opt-in'` or `scope: 'none'`;
- you export or print images and want them compensated;
- you render outside the DOM (OffscreenCanvas, WebGL read-back, server-side);
- you want to compensate *only* the content (for example the map tiles) and not the UI chrome.

```ts
import { ImageCompensator } from '@eyesfree/web';

const compensator = new ImageCompensator();   // Web Worker, with automatic fallback

// Chart.js: compensate after every render
const chart = new Chart(ctx, {
  /* … */
  plugins: [{
    id: 'eyesfree',
    afterRender: (c) => compensator.compensateCanvas(c.canvas, engine.getState().plan),
  }],
});

// PDF.js: compensate each rendered page
await page.render({ canvasContext: ctx, viewport }).promise;
await compensator.compensateCanvas(canvas, engine.getState().plan);

// Images: get a compensated <canvas>
const out = await compensator.compensateImage(imgElement, engine.getProfile());
```

## Server-side (Node)

```ts
import sharp from 'sharp';
import { compensatePixels, createRenderPlan, decodeProfile } from '@eyesfree/core';

const { data, info } = await sharp('receipt.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const plan = createRenderPlan(decodeProfile('EF1.hm211.100.100'));
const out = compensatePixels(new Uint8ClampedArray(data), info.width, info.height, plan);
await sharp(Buffer.from(out), { raw: { width: info.width, height: info.height, channels: 4 } }).toFile('receipt-ef.png');
```

## Performance tips

- Re-compensate only when the content or the plan changes. Subscribe with `engine.subscribe`.
- With high-DPI canvases, the work scales with the *backing-store* pixel count.
- Each job transfers its buffer to the worker, so there is no copy on the way back.
