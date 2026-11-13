# Native iOS & Android (reference snippets)

Native apps can interoperate through the [EF1 code and spec](../profile-spec.md). Below are minimal building blocks.

> These are reference snippets. They have not yet been verified on devices or covered by tests. Validate them against the [porting checklist](../profile-spec.md#porting-checklist).

## iOS: SwiftUI text

```swift
struct EyesFreeText: ViewModifier {
  let crowding: Int; let axis: String; let intensity: CGFloat; let enabled: Bool
  private let spacing: [CGFloat] = [0.01, 0.04, 0.065, 0.095]

  func body(content: Content) -> some View {
    guard enabled else { return AnyView(content) }
    let (lx, ly): (CGFloat, CGFloat) = {
      switch axis { case "h": return (-1.3, 0); case "v": return (0, -1.3)
                    case "b": return (-1.2, -1.2); case "a": return (1.2, -1.2); default: return (0, 0) }
    }()
    return AnyView(content
      .kerning(spacing[crowding] * 17)            // em × point size
      .shadow(color: .white.opacity(0.95), radius: 0, x: lx * intensity, y: ly * intensity))
  }
}
```

## iOS: true deconvolution for images and snapshots (Core Image)

```swift
import CoreImage.CIFilterBuiltins

func compensate(_ image: CIImage, kernel: [CGFloat], slope: CGFloat = 0.86, intercept: CGFloat = 0.04) -> CIImage {
  let tone = CIFilter.colorMatrix()
  tone.inputImage = image
  tone.rVector = CIVector(x: slope, y: 0, z: 0, w: 0)
  tone.gVector = CIVector(x: 0, y: slope, z: 0, w: 0)
  tone.bVector = CIVector(x: 0, y: 0, z: slope, w: 0)
  tone.biasVector = CIVector(x: intercept, y: intercept, z: intercept, w: 0)

  let conv = CIFilter.convolution3X3()
  conv.inputImage = tone.outputImage
  conv.weights = CIVector(values: kernel, count: 9)   // row-major, like the spec
  conv.bias = 0
  return conv.outputImage!.cropped(to: image.extent)
}
```

`CIConvolution3X3` is built into Core Image. Use it for receipts, scanned documents and map tiles.

## Android: Compose text

```kotlin
fun eyesfreeTextStyle(base: TextStyle, crowding: Int, axis: Char, intensity: Float): TextStyle {
  val spacing = floatArrayOf(0.01f, 0.04f, 0.065f, 0.095f)[crowding]
  val (x, y) = when (axis) { 'h' -> -1.3f to 0f; 'v' -> 0f to -1.3f; 'b' -> -1.2f to -1.2f; 'a' -> 1.2f to -1.2f; else -> 0f to 0f }
  return base.copy(
    letterSpacing = spacing.em,
    shadow = if (x == 0f && y == 0f) null else Shadow(Color.White.copy(alpha = 0.95f), Offset(x * intensity, y * intensity), 1f),
  )
}
```

## Android 13+: true deconvolution with AGSL

```kotlin
val agsl = """
  uniform shader content;
  uniform float k[9];
  half4 main(float2 p) {
    half3 acc = half3(0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++)
      acc += (content.eval(p + float2(i, j)).rgb * 0.86 + 0.04) * k[(j + 1) * 3 + (i + 1)];
    return half4(clamp(acc, 0, 1), content.eval(p).a);
  }
"""
val shader = RuntimeShader(agsl).apply { setFloatUniform("k", kernel) }
view.setRenderEffect(RenderEffect.createRuntimeShaderEffect(shader, "content"))
// Compose: Modifier.graphicsLayer { renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "content").asComposeRenderEffect() }
```

On Android 12 and lower, fall back to the text-style approximation.

## Calibration UI

Re-create the two steps natively, or show the web calibrator in a WebView and read the result back with the EF1 code (see [hybrid-and-webviews.md](hybrid-and-webviews.md#webview--native)). The WebView route guarantees pixel-identical previews across platforms.
