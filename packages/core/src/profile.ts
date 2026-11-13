import {
  CROWDING_LEVELS,
  DEFAULT_PROFILE,
  FONT_SCALE_RANGE,
  GHOST_AXES,
  INTENSITY_RANGE,
  PROFILE_VERSION,
  SHARPNESS_LEVELS,
} from './constants.js';
import type { CrowdingLevel, GhostAxis, SharpnessLevel, ValidationResult, VisionProfile } from './types.js';

type AnyRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is AnyRecord => typeof v === 'object' && v !== null && !Array.isArray(v);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Ghost-axis names used by the original HTML prototype. */
const LEGACY_AXIS: Readonly<Record<string, GhostAxis>> = {
  horiz: 'horizontal',
  vert: 'vertical',
  diag1: 'diagonal135',
  diag2: 'diagonal45',
  double: 'outline',
};

export const isGhostAxis = (v: unknown): v is GhostAxis => GHOST_AXES.includes(v as GhostAxis);
export const isSharpnessLevel = (v: unknown): v is SharpnessLevel => SHARPNESS_LEVELS.includes(v as SharpnessLevel);
export const isCrowdingLevel = (v: unknown): v is CrowdingLevel => CROWDING_LEVELS.includes(v as CrowdingLevel);

/**
 * Strictly validates an unknown value against the {@link VisionProfile} schema.
 * Use {@link normalizeProfile} instead when you want a best-effort repair.
 */
export function validateProfile(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ['profile must be an object'] };
  if (input.version !== PROFILE_VERSION) errors.push(`version must be ${PROFILE_VERSION}`);
  if (typeof input.enabled !== 'boolean') errors.push('enabled must be a boolean');
  if (!isGhostAxis(input.ghostAxis)) errors.push(`ghostAxis must be one of: ${GHOST_AXES.join(', ')}`);
  if (!isSharpnessLevel(input.sharpness)) errors.push(`sharpness must be one of: ${SHARPNESS_LEVELS.join(', ')}`);
  if (!isCrowdingLevel(input.crowding)) errors.push('crowding must be 0, 1, 2 or 3');
  if (typeof input.intensity !== 'number' || !Number.isFinite(input.intensity) || input.intensity < INTENSITY_RANGE.min || input.intensity > INTENSITY_RANGE.max) {
    errors.push(`intensity must be a number between ${INTENSITY_RANGE.min} and ${INTENSITY_RANGE.max}`);
  }
  if (typeof input.surfaceCompensation !== 'boolean') errors.push('surfaceCompensation must be a boolean');
  if (typeof input.fontScale !== 'number' || !Number.isFinite(input.fontScale) || input.fontScale < FONT_SCALE_RANGE.min || input.fontScale > FONT_SCALE_RANGE.max) {
    errors.push(`fontScale must be a number between ${FONT_SCALE_RANGE.min} and ${FONT_SCALE_RANGE.max}`);
  }
  if (input.updatedAt !== undefined && typeof input.updatedAt !== 'string') errors.push('updatedAt must be an ISO-8601 string');
  return { valid: errors.length === 0, errors };
}

/** Type guard for a fully valid profile. */
export function isVisionProfile(input: unknown): input is VisionProfile {
  return validateProfile(input).valid;
}

/**
 * Best-effort conversion of any input into a valid {@link VisionProfile}.
 *
 * - Missing / invalid fields fall back to {@link DEFAULT_PROFILE}.
 * - Numbers are clamped into range.
 * - Profiles saved by the original prototype (`ghostAxis: 'horiz'`, `sharpnessLevel`,
 *   `crowdingLevel`) are migrated automatically.
 */
export function normalizeProfile(input?: unknown): VisionProfile {
  const src: AnyRecord = isRecord(input) ? input : {};

  let ghostAxis: unknown = src.ghostAxis;
  if (typeof ghostAxis === 'string' && LEGACY_AXIS[ghostAxis]) ghostAxis = LEGACY_AXIS[ghostAxis];

  const sharpness: unknown = src.sharpness ?? src.sharpnessLevel;
  const crowdingRaw: unknown = src.crowding ?? src.crowdingLevel;
  const crowding = typeof crowdingRaw === 'string' ? Number(crowdingRaw) : crowdingRaw;

  const num = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback;

  const profile: VisionProfile = {
    version: PROFILE_VERSION,
    enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_PROFILE.enabled,
    ghostAxis: isGhostAxis(ghostAxis) ? ghostAxis : DEFAULT_PROFILE.ghostAxis,
    sharpness: isSharpnessLevel(sharpness) ? sharpness : DEFAULT_PROFILE.sharpness,
    crowding: isCrowdingLevel(crowding) ? crowding : DEFAULT_PROFILE.crowding,
    intensity: num(src.intensity, DEFAULT_PROFILE.intensity, INTENSITY_RANGE.min, INTENSITY_RANGE.max),
    surfaceCompensation:
      typeof src.surfaceCompensation === 'boolean' ? src.surfaceCompensation : DEFAULT_PROFILE.surfaceCompensation,
    fontScale: num(src.fontScale, DEFAULT_PROFILE.fontScale, FONT_SCALE_RANGE.min, FONT_SCALE_RANGE.max),
  };
  if (typeof src.updatedAt === 'string') profile.updatedAt = src.updatedAt;
  return profile;
}

/** Creates a new profile from defaults + overrides, stamped with `updatedAt`. */
export function createProfile(overrides: Partial<VisionProfile> = {}): VisionProfile {
  return { ...normalizeProfile({ ...DEFAULT_PROFILE, ...overrides }), updatedAt: new Date().toISOString() };
}

/** Returns a new profile with `patch` applied, re-validated and re-stamped. */
export function updateProfile(profile: VisionProfile, patch: Partial<VisionProfile>): VisionProfile {
  return { ...normalizeProfile({ ...profile, ...patch }), updatedAt: new Date().toISOString() };
}

/** Compares two profiles, ignoring `updatedAt`. */
export function profilesEqual(a: VisionProfile | null | undefined, b: VisionProfile | null | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.enabled === b.enabled &&
    a.ghostAxis === b.ghostAxis &&
    a.sharpness === b.sharpness &&
    a.crowding === b.crowding &&
    a.intensity === b.intensity &&
    a.surfaceCompensation === b.surfaceCompensation &&
    a.fontScale === b.fontScale
  );
}
