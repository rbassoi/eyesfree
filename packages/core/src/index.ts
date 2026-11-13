/**
 * @eyesfree/core — framework-agnostic heart of EyesFree.
 *
 * Pure functions only: no DOM, no storage, no platform APIs. Safe to use in Node, Web
 * Workers, React Native, Deno, Bun, or as a reference for ports to other languages.
 *
 * Original project: https://github.com/rbassoi/eyesfree — Apache-2.0
 */
export type {
  ConvolutionKernel,
  CrowdingLevel,
  GhostAxis,
  RenderPlan,
  ShadowSpec,
  SharpnessLevel,
  SurfacePalette,
  ToneMapping,
  UnsharpSpec,
  ValidationResult,
  VisionProfile,
} from './types.js';

export {
  BLUR_RADIUS_RANGE,
  BLUR_RADIUS_STEPS,
  DISTANCE_OPTIONS_CM,
  REFERENCE_READING_DISTANCE_CM,
  VIEWING_DISTANCE_RANGE,
  CROWDING_LEVELS,
  CROWDING_SPACING,
  DEFAULT_PROFILE,
  DIRECTIONAL_STRENGTH,
  FONT_SCALE_RANGE,
  FONT_SCALE_STEPS,
  GHOST_AXES,
  GHOST_AXIS_ANGLE,
  GHOST_SHADOW,
  INTENSITY_RANGE,
  PROFILE_VERSION,
  SHARPNESS_LEVELS,
  SHARPNESS_PRESETS,
  SHARPNESS_WEIGHT_DELTA,
  SURFACE_PALETTE,
  SURFACE_TONE,
  TEXT_STROKE_PX,
  UNSHARP_AMOUNT,
} from './constants.js';

export { deconvolutionKernel, directionalKernel, identityKernel, kernelSum, kernelToString, roundWeight } from './kernels.js';
export { directionalShadows, ghostShadows, outlineShadows, rgbaToCss, shadowsToCss } from './shadows.js';
export {
  createProfile,
  isCrowdingLevel,
  isGhostAxis,
  isSharpnessLevel,
  isVisionProfile,
  normalizeProfile,
  profilesEqual,
  suggestFontScale,
  updateProfile,
  validateProfile,
} from './profile.js';
export { decodeProfile, encodeProfile, parseProfile, PROFILE_CODE_PREFIX, serializeProfile } from './codec.js';
export { createRenderPlan, ghostKernel, INACTIVE_PLAN } from './plan.js';
export { compensatePixels, convolveRGBA, toneMapRGBA, unsharpRGBA } from './image.js';

/** Library version. */
export const VERSION = '0.3.0';
