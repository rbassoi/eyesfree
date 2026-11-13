import {
  CROWDING_SPACING,
  DIRECTIONAL_STRENGTH,
  GHOST_AXIS_ANGLE,
  SHARPNESS_PRESETS,
  SHARPNESS_WEIGHT_DELTA,
  SURFACE_PALETTE,
  SURFACE_TONE,
  TEXT_STROKE_PX,
  UNSHARP_AMOUNT,
} from './constants.js';
import { roundWeight } from './kernels.js';
import { deconvolutionKernel, directionalKernel } from './kernels.js';
import { normalizeProfile } from './profile.js';
import { ghostShadows, shadowsToCss } from './shadows.js';
import type { ConvolutionKernel, GhostAxis, RenderPlan, UnsharpSpec, VisionProfile } from './types.js';

/** Plan that renders content untouched. */
export const INACTIVE_PLAN: Readonly<RenderPlan> = Object.freeze({
  active: false,
  tone: null,
  kernels: [],
  unsharp: null,
  textStrokePx: 0,
  shadows: [],
  textShadowCss: 'none',
  letterSpacingEm: 0,
  wordSpacingEm: 0,
  fontWeightDelta: 0,
  fontScale: 1,
  viewingDistanceCm: 0,
  surface: null,
});

/** Directional anti-ghosting kernel for an axis (or `null` for none / outline). */
export function ghostKernel(axis: GhostAxis, intensity = 1): ConvolutionKernel | null {
  const angle = GHOST_AXIS_ANGLE[axis];
  if (angle === null) return null;
  const strength = angle % 90 === 0 ? DIRECTIONAL_STRENGTH.orthogonal : DIRECTIONAL_STRENGTH.diagonal;
  return directionalKernel(angle, strength * intensity);
}

/**
 * Turns a (possibly partial or untrusted) profile into a platform-neutral render plan.
 *
 * Pipeline order, which every adapter must respect:
 * 1. tone mapping (surface compensation)
 * 2. directional anti-ghosting kernel (step 3 choice)
 * 3. pre-sharpening (step 2 choice): large-radius unsharp mask when `blurRadius > 0`,
 *    otherwise the legacy isotropic 3×3 kernel
 * 4. text magnification, stroke, shadows and spacing (text only)
 */
export function createRenderPlan(input: Partial<VisionProfile> | VisionProfile | null | undefined): RenderPlan {
  if (input === null || input === undefined) return { ...INACTIVE_PLAN };
  const p = normalizeProfile(input);
  if (!p.enabled) return { ...INACTIVE_PLAN };

  const kernels: ConvolutionKernel[] = [];
  const g = ghostKernel(p.ghostAxis, p.intensity);
  if (g) kernels.push(g);
  let unsharp: UnsharpSpec | null = null;
  if (p.sharpness !== 'none') {
    if (p.blurRadius > 0) {
      unsharp = { sigma: roundWeight(p.blurRadius), amount: roundWeight(UNSHARP_AMOUNT[p.sharpness] * p.intensity) };
    } else {
      const { k, d } = SHARPNESS_PRESETS[p.sharpness];
      kernels.push(deconvolutionKernel(k * p.intensity, d * p.intensity));
    }
  }

  const shadows = ghostShadows(p.ghostAxis, p.intensity);
  const spacing = CROWDING_SPACING[p.crowding];
  const needsHeadroom = kernels.length > 0 || unsharp !== null || shadows.length > 0;

  return {
    active: true,
    tone: p.surfaceCompensation && needsHeadroom ? { ...SURFACE_TONE } : null,
    kernels,
    unsharp,
    textStrokePx: roundWeight(TEXT_STROKE_PX[p.sharpness] * p.intensity),
    shadows,
    textShadowCss: shadowsToCss(shadows),
    letterSpacingEm: spacing.letter,
    wordSpacingEm: spacing.word,
    fontWeightDelta: SHARPNESS_WEIGHT_DELTA[p.sharpness],
    fontScale: p.fontScale,
    viewingDistanceCm: p.viewingDistance,
    surface: p.surfaceCompensation ? { ...SURFACE_PALETTE } : null,
  };
}
