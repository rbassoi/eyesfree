import { BLUR_RADIUS_RANGE, DEFAULT_PROFILE, FONT_SCALE_RANGE, INTENSITY_RANGE, PROFILE_VERSION } from './constants.js';
import { normalizeProfile } from './profile.js';
import type { CrowdingLevel, GhostAxis, SharpnessLevel, VisionProfile } from './types.js';

/**
 * Compact, URL-safe, human-copyable profile code — ideal for deep links, QR codes, push
 * payloads, or handing a profile from a native shell to a WebView.
 *
 * Format: `EF1.<axis><sharpness><crowding><surface><enabled>.<intensity×100>.<fontScale×100>.<blurRadius×100>`
 * (the last segment is optional when decoding; it defaults to 3 px)
 *
 * Example: `EF1.nm211.100.100.300` → no ghosting, medium sharpness, crowding 2, surface
 * compensation on, enabled, intensity 1.00, font scale 1.00, blur radius 3 px.
 */
export const PROFILE_CODE_PREFIX = 'EF1';

const AXIS_TO_CODE: Readonly<Record<GhostAxis, string>> = {
  none: 'n',
  horizontal: 'h',
  vertical: 'v',
  diagonal45: 'a',
  diagonal135: 'b',
  outline: 'o',
};
const SHARP_TO_CODE: Readonly<Record<SharpnessLevel, string>> = { none: 'n', mild: 'l', medium: 'm', strong: 's' };

const invert = <K extends string>(m: Readonly<Record<K, string>>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, K>;
const CODE_TO_AXIS = invert(AXIS_TO_CODE);
const CODE_TO_SHARP = invert(SHARP_TO_CODE);

/** The 4th segment (blur radius × 100) was added in 0.2 and is optional when decoding. */
const CODE_RE = /^EF1\.([nhvabo])([nlms])([0-3])([01])([01])\.(\d{1,3})\.(\d{1,3})(?:\.(\d{1,4}))?$/;

/** Encodes a profile as a compact code (see {@link PROFILE_CODE_PREFIX}). */
export function encodeProfile(input: VisionProfile): string {
  const p = normalizeProfile(input);
  return [
    PROFILE_CODE_PREFIX,
    AXIS_TO_CODE[p.ghostAxis] +
      SHARP_TO_CODE[p.sharpness] +
      String(p.crowding) +
      (p.surfaceCompensation ? '1' : '0') +
      (p.enabled ? '1' : '0'),
    String(Math.round(p.intensity * 100)),
    String(Math.round(p.fontScale * 100)),
    String(Math.round(p.blurRadius * 100)),
  ].join('.');
}

/** Decodes a profile code. Returns `null` when the code is malformed or out of range. */
export function decodeProfile(code: string): VisionProfile | null {
  if (typeof code !== 'string') return null;
  const m = CODE_RE.exec(code.trim());
  if (!m) return null;
  const [, axis, sharp, crowding, surface, enabled, intensity, fontScale, radius] = m;
  const i = Number(intensity) / 100;
  const f = Number(fontScale) / 100;
  const r = radius === undefined ? DEFAULT_PROFILE.blurRadius : Number(radius) / 100;
  if (i < INTENSITY_RANGE.min || i > INTENSITY_RANGE.max) return null;
  if (f < FONT_SCALE_RANGE.min || f > FONT_SCALE_RANGE.max) return null;
  if (r < BLUR_RADIUS_RANGE.min || r > BLUR_RADIUS_RANGE.max) return null;
  return {
    version: PROFILE_VERSION,
    ghostAxis: CODE_TO_AXIS[axis!]!,
    sharpness: CODE_TO_SHARP[sharp!]!,
    blurRadius: r,
    crowding: Number(crowding) as CrowdingLevel,
    surfaceCompensation: surface === '1',
    enabled: enabled === '1',
    intensity: i,
    fontScale: f,
  };
}

/** Serialises a profile for storage (JSON). */
export function serializeProfile(profile: VisionProfile): string {
  return JSON.stringify(normalizeProfile(profile));
}

/**
 * Parses anything a storage backend might hand back: a JSON string, a profile code, or an
 * already-parsed object. Returns `null` for empty / unreadable input.
 */
export function parseProfile(raw: unknown): VisionProfile | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith(PROFILE_CODE_PREFIX + '.')) return decodeProfile(s);
    try {
      const parsed: unknown = JSON.parse(s);
      return typeof parsed === 'object' && parsed !== null ? normalizeProfile(parsed) : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? normalizeProfile(raw) : null;
}
