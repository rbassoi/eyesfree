# `@eyesfree/react` API

```bash
npm install @eyesfree/react
```

React ≥ 18. It is compatible with StrictMode, Next.js, Remix and Vite.

## `<EyesFreeProvider options? engine?>`

Creates an `EyesFree` engine (or uses the one you pass), calls `init()` on mount and provides it through context. `options` is read once.

```tsx
<EyesFreeProvider options={{ root: '#root', scope: 'root' }}>
  <App />
</EyesFreeProvider>
```

Pass `engine` to share one engine with non-React code (micro-frontends, analytics, a legacy widget).

## `useEyesFree()`

```ts
const {
  ready, profile, plan, active,
  apply, update, enable, disable, toggle, reset,
  shareCode, engine,
} = useEyesFree();
```

The hook is backed by `useSyncExternalStore`, so it is tear-free under concurrent rendering.

## `useEyesFreePlan()` / `useEyesFreeEngine()`

These return only the `RenderPlan` (to style a canvas or chart) or the raw engine.

## `<EyesFreeCalibrator />`

| Prop | Type | Description |
|---|---|---|
| `locale` | `string` | |
| `messages` | `Partial<CalibratorMessages>` | |
| `autoApply` | `boolean` (true) | Apply through the provider's engine. |
| `initialProfile` | `Partial<VisionProfile>` | |
| `sampleLetters`, `sampleText` | `string` | |
| `hideCancel` | `boolean` | |
| `onComplete(profile)` | | |
| `onCancel()` | | |
| `onChange(profile, step)` | | |
| `onStep(step)` | | |
| `className`, `style` | | |

On mount, the component starts a session and suspends the engine. Unmounting resumes it. It also works without a provider, in which case you handle `onComplete` yourself.

### Next.js (App Router)

Mark the components that use EyesFree as client components:

```tsx
'use client';
import { EyesFreeProvider } from '@eyesfree/react';
export default function Providers({ children }) {
  return <EyesFreeProvider options={{ root: 'body' }}>{children}</EyesFreeProvider>;
}
```

The packages are SSR-safe: nothing touches `window` until mount.
