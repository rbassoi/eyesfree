# React Native / Expo

```bash
npx expo install @react-native-async-storage/async-storage
npm install @eyesfree/react-native
```

## 1. Provider

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EyesFreeProvider } from '@eyesfree/react-native';

export default function App() {
  return (
    <EyesFreeProvider storage={AsyncStorage}>
      <Navigation />
    </EyesFreeProvider>
  );
}
```

## 2. Use compensated text

Replace `<Text>` with `<EyesFreeText>` in the places that matter most (amounts, dates, dosages, messages), or across the app through your design-system `Text` component:

```tsx
import { EyesFreeText, EyesFreeSurface } from '@eyesfree/react-native';

<EyesFreeSurface style={styles.screen}>
  <EyesFreeText style={styles.balance}>$3,482.65</EyesFreeText>
  <EyesFreeSurface kind="surface" style={styles.card}>
    <EyesFreeText style={styles.label}>Take 1 tablet at 2 PM</EyesFreeText>
  </EyesFreeSurface>
</EyesFreeSurface>
```

To build it into your own design system:

```tsx
import { useEyesFreeTextStyle } from '@eyesfree/react-native';

export function AppText({ style, ...props }: TextProps) {
  const s = useEyesFreeTextStyle([styles.base, style]);
  return <Text {...props} style={s} />;
}
```

## 3. Calibration screen

```tsx
import { EyesFreeCalibrator } from '@eyesfree/react-native';

export function VisionScreen({ navigation }) {
  return (
    <EyesFreeCalibrator
      accentColor="#1d4ed8"
      messages={{ sampleText: 'Your appointment is on 03/12 at 2:30 PM' }}
      onComplete={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}
```

For Portuguese or Spanish, pass `messages` (the strings mirror those of `@eyesfree/calibrator`, which you can import from there if you share code with the web).

## 4. Deep links

```tsx
const url = Linking.useURL();
const code = url ? new URL(url).searchParams.get('eyesfree') : null;
<EyesFreeProvider storage={AsyncStorage} initialProfile={code}>…</EyesFreeProvider>
```

## GPU-accurate rendering with Skia

The package approximates deconvolution with font weight and shadows, because React Native has no convolution primitive. For screens where fidelity matters (a receipt, a prescription), render the content with `@shopify/react-native-skia` and apply the plan's kernels as a runtime shader:

```tsx
import { Canvas, Text, Group, Skia, useFont } from '@shopify/react-native-skia';
import { useEyesFreePlan } from '@eyesfree/react-native';

const source = Skia.RuntimeEffect.Make(`
  uniform shader image;
  uniform float k[9];
  uniform float slope; uniform float intercept;
  half4 main(float2 p) {
    half4 c = image.eval(p);
    half3 acc = half3(0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      half3 s = image.eval(p + float2(i, j)).rgb * slope + intercept;
      acc += s * k[(j + 1) * 3 + (i + 1)];
    }
    return half4(clamp(acc, 0.0, 1.0), c.a);
  }
`)!;

function CompensatedLabel({ text }: { text: string }) {
  const plan = useEyesFreePlan();
  const font = useFont(require('./Inter-Bold.ttf'), 22);
  const kernel = plan?.kernels.at(-1)?.matrix ?? [0, 0, 0, 0, 1, 0, 0, 0, 0];
  const tone = plan?.tone ?? { slope: 1, intercept: 0 };
  const filter = Skia.ImageFilter.MakeRuntimeShader(
    Skia.RuntimeShaderBuilder(source, { k: kernel, slope: tone.slope, intercept: tone.intercept } as never),
    'image', null,
  );
  return (
    <Canvas style={{ height: 40 }}>
      <Group layer={Skia.Paint()} imageFilter={filter}>
        <Text x={0} y={28} text={text} font={font} />
      </Group>
    </Canvas>
  );
}
```

> This snippet is a starting point and has not been tested on devices. The Skia API differs between versions, so check `RuntimeShaderBuilder` / `ImageFilter.MakeRuntimeShader` for your version. A first-class Skia component is on the roadmap.

## Notes

- RN `letterSpacing` is absolute, so EyesFree converts em to points using the style's `fontSize` (default 14).
- Android does not draw text shadows with radius 0, so EyesFree uses radius 1.
- Respect the system font scale. `fontScale` from the profile multiplies on top of it.
