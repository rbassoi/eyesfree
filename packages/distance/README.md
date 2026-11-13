# @eyesfree/distance

Opt-in, on-device camera distance measurement for [EyesFree](https://github.com/rbassoi/eyesfree). It tells people who use reading glasses where they see sharply without them, and reminds them to stay there ("Move back a little: you are about 70 cm away, the best is 1 m").

```bash
npm install @eyesfree/distance
```

```ts
import { DistanceMonitor, createDistanceGuard } from '@eyesfree/distance';
const monitor = new DistanceMonitor();
createDistanceGuard({ engine, monitor });
await monitor.start(); // asks for camera permission; frames never leave the device
```

📷 [Guide (computer vs phone)](https://github.com/rbassoi/eyesfree/blob/main/docs/integrations/distance.md) · 📚 [API](https://github.com/rbassoi/eyesfree/blob/main/docs/api/distance.md) · Apache-2.0 (keep the NOTICE file). Uses MediaPipe (Apache-2.0), loaded at runtime.
