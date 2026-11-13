import type { CrowdingLevel, GhostAxis, SharpnessLevel, SurfacePalette, ToneMapping, VisionProfile } from './types.js';

export const PROFILE_VERSION = 1 as const;

export const GHOST_AXES: readonly GhostAxis[] = ['none', 'horizontal', 'vertical', 'diagonal45', 'diagonal135', 'outline'];
export const SHARPNESS_LEVELS: readonly SharpnessLevel[] = ['none', 'mild', 'medium', 'strong'];
export const CROWDING_LEVELS: readonly CrowdingLevel[] = [0, 1, 2, 3];

export const INTENSITY_RANGE = { min: 0.25, max: 2 } as const;
export const FONT_SCALE_RANGE = { min: 1, max: 4 } as const;
/** Viewing distance hint in cm. 0 = unknown / normal reading distance. */
export const VIEWING_DISTANCE_RANGE = { min: 0, max: 300 } as const;

/** Distance at which text is normally read (cm); magnification is relative to it. */
export const REFERENCE_READING_DISTANCE_CM = 40;

/**
 * Distances offered by the calibrator's distance step (cm). A presbyopic eye without its
 * reading glasses focuses sharply only beyond a certain distance (≈ 100 / remaining
 * accommodation in dioptres); sitting there and magnifying is the one approach that gives
 * truly sharp text.
 */
export const DISTANCE_OPTIONS_CM: readonly number[] = [50, 70, 100, 130, 160, 200];
/** Blur radius (Gaussian σ, CSS px). 0 selects the legacy 3×3 kernel. */
export const BLUR_RADIUS_RANGE = { min: 0, max: 12 } as const;

/** Text-size options offered by the calibrator. */
export const FONT_SCALE_STEPS: readonly number[] = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4];

/**
 * Blur-radius stops offered by the calibrator slider (σ in CSS px).
 *
 * Rough guide: an eye defocused by D dioptres with a ~4 mm pupil spreads each point over
 * ≈ 4·D milliradians; at 30–40 cm that is ≈ 1.2–1.6·D mm on screen, i.e. ≈ 5·D CSS px
 * on a typical desktop (σ ≈ diameter / 4 ≈ 1.2·D px). Users simply pick what looks best.
 */
export const BLUR_RADIUS_STEPS: readonly number[] = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Unsharp amount per sharpness level (used when `blurRadius > 0`). */
export const UNSHARP_AMOUNT: Readonly<Record<SharpnessLevel, number>> = {
  none: 0,
  mild: 0.6,
  medium: 1.0,
  strong: 1.5,
};

/** Stroke thickening per sharpness level (CSS px) — thicker strokes survive blur better. */
export const TEXT_STROKE_PX: Readonly<Record<SharpnessLevel, number>> = {
  none: 0,
  mild: 0.15,
  medium: 0.3,
  strong: 0.45,
};

/** Angle (degrees, counter-clockwise from horizontal) for each directional ghost axis. */
export const GHOST_AXIS_ANGLE: Readonly<Record<GhostAxis, number | null>> = {
  none: null,
  horizontal: 0,
  vertical: 90,
  diagonal45: 45,
  diagonal135: 135,
  outline: null,
};

/**
 * Isotropic deconvolution presets. `k` is the weight of the 4 orthogonal neighbours and
 * `d` the weight of the 4 diagonal neighbours (both subtracted). The centre weight is
 * `1 + 4k + 4d`, so the kernel always sums to 1.
 *
 * The values reproduce the original prototype, which was tuned perceptually for
 * approximate refractive errors of ~1.0 D (mild), ~1.75 D (medium) and ≥2.5 D (strong).
 */
export const SHARPNESS_PRESETS: Readonly<Record<SharpnessLevel, { k: number; d: number }>> = {
  none: { k: 0, d: 0 },
  mild: { k: 0.55, d: 0 },
  medium: { k: 0.95, d: 0 },
  strong: { k: 1.15, d: 0.25 },
};

/** Directional (anti-ghosting) kernel strength per axis family. */
export const DIRECTIONAL_STRENGTH = { orthogonal: 1.1, diagonal: 1.0 } as const;

/**
 * Text-shadow magnitudes (px) for ghost cancellation: a light "phase-cancelling" halo on
 * one side of the ghost vector and a dark edge reinforcement on the other.
 */
export const GHOST_SHADOW = {
  orthogonal: { light: 1.3, dark: 1.1 },
  /** Per-component offsets for diagonals. */
  diagonal: { light: 1.2, dark: 1.0 },
  lightAlpha: 0.95,
  darkAlpha: 0.45,
  outline: 1.1,
} as const;

/** Anti-crowding spacing table (em). */
export const CROWDING_SPACING: Readonly<Record<CrowdingLevel, { letter: number; word: number }>> = {
  0: { letter: 0.01, word: 0.02 },
  1: { letter: 0.04, word: 0.05 },
  2: { letter: 0.065, word: 0.08 },
  3: { letter: 0.095, word: 0.12 },
};

/** Font-weight hint per sharpness level, for renderers without convolution support. */
export const SHARPNESS_WEIGHT_DELTA: Readonly<Record<SharpnessLevel, number>> = {
  none: 0,
  mild: 100,
  medium: 200,
  strong: 300,
};

/**
 * Tone mapping used for surface compensation: pure white (1.0) becomes 0.90 (≈ #E6E6E6)
 * and pure black (0.0) becomes 0.04, leaving headroom for bright/dark halos.
 */
export const SURFACE_TONE: Readonly<ToneMapping> = Object.freeze({ slope: 0.86, intercept: 0.04 });

/** Palette equivalent to {@link SURFACE_TONE}, for hosts that restyle surfaces directly. */
export const SURFACE_PALETTE: Readonly<SurfacePalette> = Object.freeze({
  background: '#E4E7EC',
  surface: '#EAECEF',
  border: '#CBD5E1',
  text: '#0F172A',
});

/** A sensible default profile (what most users pick in informal tests). */
export const DEFAULT_PROFILE: Readonly<VisionProfile> = Object.freeze({
  version: PROFILE_VERSION,
  enabled: true,
  ghostAxis: 'none',
  sharpness: 'medium',
  blurRadius: 3,
  crowding: 2,
  intensity: 1,
  surfaceCompensation: true,
  fontScale: 1,
  viewingDistance: 0,
} as VisionProfile);
