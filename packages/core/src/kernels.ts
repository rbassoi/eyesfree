import type { ConvolutionKernel } from './types.js';

/** Rounds to 4 decimals and normalises `-0` to `0` so kernels serialise cleanly. */
export function roundWeight(n: number): number {
  const r = Math.round(n * 10000) / 10000;
  return r === 0 ? 0 : r;
}

function snap(n: number): number {
  const r = Math.round(n);
  return Math.abs(n - r) < 1e-9 ? r : n;
}

/**
 * Isotropic "inverse blur" kernel (modified Laplacian high-boost filter).
 *
 * ```
 * | -d   -k   -d |
 * | -k  1+4k+4d -k |
 * | -d   -k   -d |
 * ```
 *
 * The defocused eye behaves like a low-pass (≈ Gaussian) point-spread function. Boosting
 * high frequencies *before* the light reaches the eye partially pre-compensates it: each
 * glyph gets a hyper-dark inner edge and a hyper-bright outer edge that cancel the grey
 * transition band created by the blur.
 *
 * @param k weight of the 4 orthogonal neighbours (0.4 mild → 1.3 severe)
 * @param d weight of the 4 diagonal neighbours (default 0)
 */
export function deconvolutionKernel(k: number, d = 0): ConvolutionKernel {
  const c = 1 + 4 * k + 4 * d;
  return {
    order: 3,
    matrix: [-d, -k, -d, -k, c, -k, -d, -k, -d].map(roundWeight),
  };
}

/**
 * Directional (1-D) high-boost kernel oriented along `angleDeg`, used to cancel the
 * "ghost" copy of each glyph produced by astigmatism / coma.
 *
 * Works for any angle: the direction vector is projected onto the border of the 3×3
 * neighbourhood and its weight is distributed bilinearly between the two nearest cells,
 * so 0°, 45°, 90° and 135° land exactly on grid cells.
 *
 * @param angleDeg angle counter-clockwise from horizontal, as seen on screen
 * @param k        strength (weight of each of the two taps)
 */
export function directionalKernel(angleDeg: number, k: number): ConvolutionKernel {
  const rad = (angleDeg * Math.PI) / 180;
  // Screen coordinates: y grows downwards.
  const vx = Math.cos(rad);
  const vy = -Math.sin(rad);
  const m = Math.max(Math.abs(vx), Math.abs(vy));
  const px = snap(vx / m);
  const py = snap(vy / m);

  const w = new Array<number>(9).fill(0);
  w[4] = 1 + 2 * k;

  const splat = (x: number, y: number, weight: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const cells: Array<[number, number, number]> = [
      [x0, y0, (1 - fx) * (1 - fy)],
      [x0 + 1, y0, fx * (1 - fy)],
      [x0, y0 + 1, (1 - fx) * fy],
      [x0 + 1, y0 + 1, fx * fy],
    ];
    for (const [cx, cy, cw] of cells) {
      if (cw === 0 || cx < -1 || cx > 1 || cy < -1 || cy > 1) continue;
      w[(cy + 1) * 3 + (cx + 1)] += weight * cw;
    }
  };

  splat(px, py, -k);
  splat(-px, -py, -k);

  return { order: 3, matrix: w.map(roundWeight) };
}

/** The identity kernel (no-op). */
export function identityKernel(): ConvolutionKernel {
  return { order: 3, matrix: [0, 0, 0, 0, 1, 0, 0, 0, 0] };
}

/** Sum of a kernel's weights (should be 1 for brightness-preserving kernels). */
export function kernelSum(kernel: ConvolutionKernel): number {
  return roundWeight(kernel.matrix.reduce((a, b) => a + b, 0));
}

/** Formats a kernel for SVG `feConvolveMatrix@kernelMatrix`. */
export function kernelToString(kernel: ConvolutionKernel): string {
  return kernel.matrix.map((n) => String(roundWeight(n))).join(' ');
}
