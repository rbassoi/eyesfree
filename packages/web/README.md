# @eyesfree/web

DOM engine for [EyesFree](https://github.com/rbassoi/eyesfree). It applies optical compensation (SVG deconvolution filter, ghost-cancelling shadows, anti-crowding spacing) to any web page, PWA or WebView. It also includes a Web Worker for canvas and images.

```bash
npm install @eyesfree/web
```

```ts
import { createEyesFree } from '@eyesfree/web';
const eyesfree = createEyesFree({ root: '#app' });
eyesfree.apply({ ghostAxis: 'horizontal', sharpness: 'medium' });
```

📚 [API reference](https://github.com/rbassoi/eyesfree/blob/main/docs/api/web.md) · 🔌 [Integrations](https://github.com/rbassoi/eyesfree/blob/main/docs/integrations/README.md) · Apache-2.0 (keep the NOTICE file).
