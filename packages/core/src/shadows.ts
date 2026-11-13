import { GHOST_AXIS_ANGLE, GHOST_SHADOW } from './constants.js';
import { roundWeight } from './kernels.js';
import type { GhostAxis, ShadowSpec } from './types.js';

const WHITE = (a: number): [number, number, number, number] => [255, 255, 255, a];
const BLACK = (a: number): [number, number, number, number] => [0, 0, 0, a];

/**
 * Ghost-cancellation text shadows for an arbitrary angle.
 *
 * A light halo is placed on one side of the ghost vector (cancelling the perceived
 * "phantom" copy) and a dark edge on the opposite side (reinforcing the real glyph edge):
 *
 * `text-shadow: (−Δx, −Δy) light, (+Δx, +Δy) dark`
 *
 * Convention: the light halo is always placed towards the top (or, for horizontal ghosts,
 * the left), matching the original prototype.
 */
export function directionalShadows(angleDeg: number, intensity = 1): ShadowSpec[] {
  const rad = (angleDeg * Math.PI) / 180;
  let ux = Math.cos(rad);
  let uy = -Math.sin(rad);
  if (Math.abs(ux) < 1e-9) ux = 0;
  if (Math.abs(uy) < 1e-9) uy = 0;
  // Orient u so that it points downwards (or right when horizontal).
  if (uy < 0 || (uy === 0 && ux < 0)) {
    ux = -ux;
    uy = -uy;
  }
  const isOrthogonal = ux === 0 || uy === 0;
  const isExactDiagonal = Math.abs(Math.abs(ux) - Math.SQRT1_2) < 1e-6;

  let light: [number, number];
  let dark: [number, number];
  if (isOrthogonal || isExactDiagonal) {
    // Grid angles use the perceptually tuned per-component magnitudes.
    const mag = isOrthogonal ? GHOST_SHADOW.orthogonal : GHOST_SHADOW.diagonal;
    light = [Math.sign(ux) * mag.light, Math.sign(uy) * mag.light];
    dark = [Math.sign(ux) * mag.dark, Math.sign(uy) * mag.dark];
  } else {
    // Arbitrary angles: offset along the unit vector.
    const mag = GHOST_SHADOW.orthogonal;
    light = [ux * mag.light, uy * mag.light];
    dark = [ux * mag.dark, uy * mag.dark];
  }

  return [
    {
      x: roundWeight(-light[0] * intensity),
      y: roundWeight(-light[1] * intensity),
      blur: 0,
      color: WHITE(GHOST_SHADOW.lightAlpha),
    },
    {
      x: roundWeight(dark[0] * intensity),
      y: roundWeight(dark[1] * intensity),
      blur: 0,
      color: BLACK(roundWeight(Math.min(1, GHOST_SHADOW.darkAlpha * Math.max(1, intensity)))),
    },
  ];
}

/** All-round light halo used for radial ghosting (`outline` axis). */
export function outlineShadows(intensity = 1): ShadowSpec[] {
  const o = roundWeight(GHOST_SHADOW.outline * intensity);
  return [
    { x: -o, y: -o, blur: 0, color: WHITE(1) },
    { x: o, y: -o, blur: 0, color: WHITE(1) },
    { x: -o, y: o, blur: 0, color: WHITE(1) },
    { x: o, y: o, blur: 0, color: WHITE(1) },
  ];
}

/** Text shadows for a ghost axis. */
export function ghostShadows(axis: GhostAxis, intensity = 1): ShadowSpec[] {
  if (axis === 'none') return [];
  if (axis === 'outline') return outlineShadows(intensity);
  const angle = GHOST_AXIS_ANGLE[axis];
  return angle === null ? [] : directionalShadows(angle, intensity);
}

/** Formats an RGBA tuple as a CSS colour. */
export function rgbaToCss([r, g, b, a]: [number, number, number, number]): string {
  return `rgba(${r},${g},${b},${roundWeight(a)})`;
}

/** Formats shadows as a CSS `text-shadow` value. */
export function shadowsToCss(shadows: readonly ShadowSpec[]): string {
  if (shadows.length === 0) return 'none';
  return shadows.map((s) => `${s.x}px ${s.y}px ${s.blur}px ${rgbaToCss(s.color)}`).join(', ');
}
