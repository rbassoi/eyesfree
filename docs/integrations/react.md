# React / Next.js / Remix / Vite

```bash
npm install @eyesfree/react
```

## 1. Provide the engine

```tsx
// main.tsx
import { EyesFreeProvider } from '@eyesfree/react';

createRoot(document.getElementById('root')!).render(
  <EyesFreeProvider options={{ root: '#root' }}>
    <App />
  </EyesFreeProvider>,
);
```

## 2. Add a calibration screen

```tsx
import { EyesFreeCalibrator } from '@eyesfree/react';

export function VisionScreen() {
  const navigate = useNavigate();
  return (
    <EyesFreeCalibrator
      locale="en"
      sampleText="Your appointment is on 03/12 at 2:30 PM"
      onComplete={() => navigate('/')}
      onCancel={() => navigate(-1)}
    />
  );
}
```

## 3. Show state and an off switch

```tsx
import { useEyesFree } from '@eyesfree/react';

export function GlassesButton() {
  const { active, toggle, profile } = useEyesFree();
  if (!profile) return <Link to="/vision">👓 No glasses?</Link>;
  return <button onClick={toggle} aria-pressed={active}>👓 Reading mode {active ? 'on' : 'off'}</button>;
}
```

## 4. Canvas and charts

```tsx
import { useEyesFreePlan } from '@eyesfree/react';
import { ImageCompensator } from '@eyesfree/web';

const compensator = new ImageCompensator();

function Chart() {
  const plan = useEyesFreePlan();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    drawChart(ref.current!);
    compensator.compensateCanvas(ref.current!, plan);
  }, [plan]);
  return <canvas ref={ref} width={600} height={300} />;
}
```

## Next.js App Router

```tsx
// app/providers.tsx
'use client';
import { EyesFreeProvider } from '@eyesfree/react';
export function Providers({ children }: { children: React.ReactNode }) {
  return <EyesFreeProvider options={{ root: 'body' }}>{children}</EyesFreeProvider>;
}
```

Then wrap `{children}` with `<Providers>` in `app/layout.tsx`. To avoid a flash of uncompensated content on first paint, you can render the stored profile's CSS server-side with `filterMarkup()` and `cssVariables()` from `@eyesfree/web`, if you keep the profile in a cookie.

## Testing

In Jest or Vitest with jsdom, use `memoryAdapter()` and `sync: false`:

```tsx
<EyesFreeProvider options={{ storage: memoryAdapter(), sync: false }}>…</EyesFreeProvider>
```
