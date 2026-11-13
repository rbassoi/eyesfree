import { rgbaToCss, SURFACE_PALETTE } from '@eyesfree/core';
import type { RenderPlan } from '@eyesfree/core';
import type { TextStyle, ViewStyle } from 'react-native';

const WEIGHTS: Record<string, number> = { normal: 400, bold: 700 };

/** Raises a font weight by `delta`, clamped to RN's 100–900 string scale. */
export function boostFontWeight(base: TextStyle['fontWeight'] | undefined, delta: number): TextStyle['fontWeight'] {
  if (!delta) return base;
  const numeric = typeof base === 'number' ? base : base ? (WEIGHTS[base] ?? Number(base)) || 400 : 400;
  const w = Math.min(900, Math.max(100, Math.round((numeric + delta) / 100) * 100));
  return String(w) as TextStyle['fontWeight'];
}

export interface NativeTextStyleOptions {
  /** Font size of the text (needed because RN letterSpacing is absolute, not em). Default 14. */
  fontSize?: number;
  /** Base font weight to boost. */
  fontWeight?: TextStyle['fontWeight'];
  /** Multiply font size by the profile's `fontScale`. Default true. */
  scaleFont?: boolean;
  /**
   * Approximate deconvolution with a heavier weight (RN has no GPU convolution without
   * Skia). Default true.
   */
  boostWeight?: boolean;
}

/**
 * Converts a render plan to React Native text styles: absolute letter spacing, the most
 * important ghost-cancellation shadow (RN supports one), font-weight boost and font scale.
 */
export function nativeTextStyle(plan: RenderPlan, options: NativeTextStyleOptions = {}): TextStyle {
  if (!plan.active) return {};
  const scale = options.scaleFont === false ? 1 : plan.fontScale;
  const fontSize = (options.fontSize ?? 14) * scale;
  const style: TextStyle = {
    letterSpacing: Math.round(plan.letterSpacingEm * fontSize * 100) / 100,
  };
  if (scale !== 1) style.fontSize = fontSize;
  if (options.boostWeight !== false) {
    const w = boostFontWeight(options.fontWeight, plan.fontWeightDelta);
    if (w !== undefined) style.fontWeight = w;
  }
  const shadow = plan.shadows[0];
  if (shadow) {
    style.textShadowColor = rgbaToCss(shadow.color);
    style.textShadowOffset = { width: shadow.x, height: shadow.y };
    // Android does not draw shadows with radius 0.
    style.textShadowRadius = Math.max(shadow.blur, 1);
  }
  if (plan.surface) style.color = plan.surface.text;
  return style;
}

/** Background style giving bright halos luminance headroom (use on screens / cards). */
export function nativeSurfaceStyle(plan: RenderPlan, kind: 'background' | 'surface' = 'background'): ViewStyle {
  if (!plan.active || !plan.surface) return {};
  const palette = plan.surface ?? SURFACE_PALETTE;
  return kind === 'background'
    ? { backgroundColor: palette.background }
    : { backgroundColor: palette.surface, borderColor: palette.border };
}
