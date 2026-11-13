# Flutter (reference port)

There is no published Dart package yet (it is on the roadmap, and contributions are welcome). This page contains a compact **reference port** of the parts you need. It follows the [specification](../profile-spec.md) and can be dropped into an app as `lib/eyesfree.dart`.

> These snippets are a reference implementation and have not yet been verified on a device or covered by tests. Please run the [porting checklist](../profile-spec.md#porting-checklist) and open a PR when you publish a package.

## 1. Profile + EF1 codec

```dart
// lib/eyesfree.dart
import 'dart:math' as math;
import 'package:flutter/material.dart';

enum GhostAxis { none, horizontal, vertical, diagonal45, diagonal135, outline }
enum Sharpness { none, mild, medium, strong }

class VisionProfile {
  final bool enabled;
  final GhostAxis ghostAxis;
  final Sharpness sharpness;
  final int crowding;            // 0..3
  final double intensity;        // 0.25..2
  final bool surfaceCompensation;
  final double fontScale;        // 1..2

  const VisionProfile({
    this.enabled = true,
    this.ghostAxis = GhostAxis.none,
    this.sharpness = Sharpness.medium,
    this.crowding = 2,
    this.intensity = 1,
    this.surfaceCompensation = true,
    this.fontScale = 1,
  });

  static const _axis = {'n': GhostAxis.none, 'h': GhostAxis.horizontal, 'v': GhostAxis.vertical,
                        'a': GhostAxis.diagonal45, 'b': GhostAxis.diagonal135, 'o': GhostAxis.outline};
  static const _sharp = {'n': Sharpness.none, 'l': Sharpness.mild, 'm': Sharpness.medium, 's': Sharpness.strong};
  static final _re = RegExp(r'^EF1\.([nhvabo])([nlms])([0-3])([01])([01])\.(\d{1,3})\.(\d{1,3})$');

  static VisionProfile? decode(String code) {
    final m = _re.firstMatch(code.trim());
    if (m == null) return null;
    final i = int.parse(m[6]!) / 100, f = int.parse(m[7]!) / 100;
    if (i < .25 || i > 2 || f < 1 || f > 2) return null;
    return VisionProfile(
      ghostAxis: _axis[m[1]]!, sharpness: _sharp[m[2]]!, crowding: int.parse(m[3]!),
      surfaceCompensation: m[4] == '1', enabled: m[5] == '1', intensity: i, fontScale: f);
  }

  String encode() {
    String key<T>(Map<String, T> map, T v) => map.entries.firstWhere((e) => e.value == v).key;
    return 'EF1.${key(_axis, ghostAxis)}${key(_sharp, sharpness)}$crowding'
        '${surfaceCompensation ? 1 : 0}${enabled ? 1 : 0}.${(intensity * 100).round()}.${(fontScale * 100).round()}';
  }
}
```

## 2. Text style (spacing, shadows, weight)

```dart
const _spacing = [[0.01, 0.02], [0.04, 0.05], [0.065, 0.08], [0.095, 0.12]];

List<Shadow> ghostShadows(GhostAxis axis, double s) {
  Shadow l(double x, double y) => Shadow(offset: Offset(x * s, y * s), color: const Color(0xF2FFFFFF));
  Shadow d(double x, double y) => Shadow(offset: Offset(x * s, y * s), color: const Color(0x73000000));
  switch (axis) {
    case GhostAxis.horizontal: return [l(-1.3, 0), d(1.1, 0)];
    case GhostAxis.vertical: return [l(0, -1.3), d(0, 1.1)];
    case GhostAxis.diagonal135: return [l(-1.2, -1.2), d(1.0, 1.0)];
    case GhostAxis.diagonal45: return [l(1.2, -1.2), d(-1.0, 1.0)];
    case GhostAxis.outline:
      return [for (final o in const [Offset(-1.1, -1.1), Offset(1.1, -1.1), Offset(-1.1, 1.1), Offset(1.1, 1.1)])
        Shadow(offset: o * s, color: Colors.white)];
    case GhostAxis.none: return const [];
  }
}

TextStyle eyesfreeTextStyle(VisionProfile p, TextStyle base) {
  if (!p.enabled) return base;
  final size = (base.fontSize ?? 14) * p.fontScale;
  final sp = _spacing[p.crowding];
  final boost = {Sharpness.none: 0, Sharpness.mild: 1, Sharpness.medium: 2, Sharpness.strong: 3}[p.sharpness]!;
  final w = FontWeight.values[math.min(8, (base.fontWeight ?? FontWeight.w400).index + boost)];
  return base.copyWith(
    fontSize: size,
    letterSpacing: sp[0] * size,
    wordSpacing: sp[1] * size,
    fontWeight: w,
    shadows: ghostShadows(p.ghostAxis, p.intensity),
    color: p.surfaceCompensation ? const Color(0xFF0F172A) : base.color,
  );
}

const eyesfreeBackground = Color(0xFFE4E7EC);
```

## 3. True deconvolution with a fragment shader (Flutter ≥ 3.10)

`shaders/eyesfree.frag`:

```glsl
#include <flutter/runtime_effect.glsl>
uniform vec2 uSize;
uniform float uK[9];
uniform float uSlope;
uniform float uIntercept;
uniform sampler2D uTexture;
out vec4 fragColor;

void main() {
  vec2 px = 1.0 / uSize;
  vec2 uv = FlutterFragCoord().xy / uSize;
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec3 s = texture(uTexture, uv + vec2(float(i), float(j)) * px).rgb * uSlope + uIntercept;
      acc += s * uK[(j + 1) * 3 + (i + 1)];
    }
  }
  fragColor = vec4(clamp(acc, 0.0, 1.0), texture(uTexture, uv).a);
}
```

Declare it in `pubspec.yaml` under `flutter: shaders: [shaders/eyesfree.frag]`. Then wrap content with `ImageFiltered(imageFilter: ImageFilter.shader(...))` (Impeller, Flutter ≥ 3.22). On older engines, render to an image and draw it with `ShaderMask`. Compute the kernel as described in [profile-spec § 4](../profile-spec.md#4-kernels).

## 4. Persistence

```dart
final prefs = await SharedPreferences.getInstance();
await prefs.setString('eyesfree:profile', profile.encode());   // EF1 code is a valid stored value
```
