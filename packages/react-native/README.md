# @eyesfree/react-native

[EyesFree](https://github.com/rbassoi/eyesfree) for React Native and Expo: a provider, hooks, `<EyesFreeText>`, `<EyesFreeSurface>` and a native calibration wizard. It has no native code.

```bash
npm install @eyesfree/react-native @react-native-async-storage/async-storage
```

```tsx
<EyesFreeProvider storage={AsyncStorage}>
  <EyesFreeText style={{ fontSize: 18 }}>Balance: $3,482.65</EyesFreeText>
</EyesFreeProvider>
```

📚 [API reference](https://github.com/rbassoi/eyesfree/blob/main/docs/api/react-native.md) · Apache-2.0 (keep the NOTICE file).
