# `@eyesfree/react-native` API

```bash
npm install @eyesfree/react-native @react-native-async-storage/async-storage
```

It works with Expo and bare React Native ≥ 0.72, has no native code and needs no linking.

## `<EyesFreeProvider>`

| Prop | Type | Description |
|---|---|---|
| `storage` | `AsyncStorageLike` | `AsyncStorage`, an MMKV wrapper, or `expo-secure-store` wrapped as `getItem/setItem/removeItem`. Omit it for in-memory storage. |
| `storageKey` | `string` | Default `eyesfree:profile`. |
| `initialProfile` | object, JSON or EF1 code | Used when nothing is stored, for example from a deep link `myapp://settings?eyesfree=EF1…`. |
| `store` | `EyesFreeNativeStore` | Bring your own store. |
| `onError` | `(e) => void` | Storage errors. |

## Hooks

| Hook | Returns |
|---|---|
| `useEyesFree()` | `{ ready, profile, plan, active, apply, update, enable, disable, toggle, reset, shareCode, store }` |
| `useEyesFreePlan()` | `RenderPlan \| null` (null without a provider) |
| `useEyesFreeTextStyle(baseStyle?)` | Merged `TextStyle` for the current profile |

## Components

| Component | Description |
|---|---|
| `<EyesFreeText>` | Drop-in `<Text>`. Applies letter spacing (converted from em using the style's `fontSize`), a ghost-cancelling shadow, a font-weight boost and `fontScale`. `eyesfreeIgnore` opts out. |
| `<EyesFreeSurface kind="background" \| "surface">` | `<View>` that switches to the low-glare palette when active. |
| `<EyesFreeCalibrator>` | Native two-step wizard (`messages`, `autoApply`, `initialProfile`, `onComplete`, `onCancel`, `accentColor`, `style`). |

## Pure helpers

`nativeTextStyle(plan, { fontSize, fontWeight, scaleFont, boostWeight })`, `nativeSurfaceStyle(plan, kind)`, `boostFontWeight(weight, delta)`, `EyesFreeNativeStore`.

## Fidelity note

React Native has no built-in image convolution, so the package approximates deconvolution with weight, shadow and spacing. For pixel-accurate rendering of critical screens, use `@shopify/react-native-skia` with the plan's kernels. See [integrations/react-native.md](../integrations/react-native.md#gpu-accurate-rendering-with-skia).
