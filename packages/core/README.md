# @eyesfree/core

Framework-agnostic heart of [EyesFree](https://github.com/rbassoi/eyesfree), the toolkit for reading screens without glasses. It contains the vision profile model, the EF1 codec, the deconvolution and anti-ghosting kernels, the render plan and the pixel pipeline. It is pure TypeScript with no DOM and zero dependencies.

```bash
npm install @eyesfree/core
```

```ts
import { createRenderPlan, decodeProfile } from '@eyesfree/core';
const plan = createRenderPlan(decodeProfile('EF1.hm211.100.100'));
```

📚 [API reference](https://github.com/rbassoi/eyesfree/blob/main/docs/api/core.md) · 📄 [Spec](https://github.com/rbassoi/eyesfree/blob/main/docs/profile-spec.md) · Apache-2.0 (keep the NOTICE file).
