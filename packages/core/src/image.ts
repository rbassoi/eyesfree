import type { RenderPlan } from './types.js';

/*
 * Pixel-level implementation of the render plan, for canvas / image content and for
 * platforms without GPU filters.
 *
 * IMPORTANT: `convolveRGBA` and `toneMapRGBA` must stay SELF-CONTAINED (no references to
 * anything outside their own body) because `@eyesfree/web` serialises them with
 * `Function.prototype.toString()` to build its Web Worker without a bundler.
 */

/**
 * Applies a 3×3 kernel to RGBA pixels (alpha preserved, edges clamped).
 * Returns a new buffer; `src` is not modified.
 */
export function convolveRGBA(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: ArrayLike<number>,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const k0 = kernel[0], k1 = kernel[1], k2 = kernel[2];
  const k3 = kernel[3], k4 = kernel[4], k5 = kernel[5];
  const k6 = kernel[6], k7 = kernel[7], k8 = kernel[8];
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    const rowM = (y > 0 ? y - 1 : 0) * stride;
    const row0 = y * stride;
    const rowP = (y < height - 1 ? y + 1 : y) * stride;
    for (let x = 0; x < width; x++) {
      const cM = (x > 0 ? x - 1 : 0) * 4;
      const c0 = x * 4;
      const cP = (x < width - 1 ? x + 1 : x) * 4;
      const i = row0 + c0;
      for (let c = 0; c < 3; c++) {
        out[i + c] =
          k0 * src[rowM + cM + c] + k1 * src[rowM + c0 + c] + k2 * src[rowM + cP + c] +
          k3 * src[row0 + cM + c] + k4 * src[row0 + c0 + c] + k5 * src[row0 + cP + c] +
          k6 * src[rowP + cM + c] + k7 * src[rowP + c0 + c] + k8 * src[rowP + cP + c];
      }
      out[i + 3] = src[i + 3];
    }
  }
  return out;
}

/** Linear tone mapping of RGB channels, in place: `v = v * slope + intercept * 255`. */
export function toneMapRGBA(data: Uint8ClampedArray, slope: number, intercept: number): Uint8ClampedArray {
  const offset = intercept * 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * slope + offset;
    data[i + 1] = data[i + 1] * slope + offset;
    data[i + 2] = data[i + 2] * slope + offset;
  }
  return data;
}

/**
 * Large-radius unsharp mask on RGBA pixels (alpha preserved, edges clamped):
 * `out = in + amount × (in − gaussianBlur(in, sigma))`. Separable Gaussian, O(r) per pixel.
 * Returns a new buffer. SELF-CONTAINED (serialised into the Web Worker).
 *
 * @param sigma  Gaussian σ in pixels of this buffer (scale CSS px by devicePixelRatio)
 */
export function unsharpRGBA(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number,
  amount: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  if (!(sigma > 0) || !amount) {
    out.set(src);
    return out;
  }
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const weights = new Float32Array(radius * 2 + 1);
  let total = 0;
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    weights[i + radius] = w;
    total += w;
  }
  for (let i = 0; i < weights.length; i++) weights[i] /= total;

  // Horizontal pass → tmp (float, RGB only)
  const tmp = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -radius; k <= radius; k++) {
        let xx = x + k;
        if (xx < 0) xx = 0;
        else if (xx >= width) xx = width - 1;
        const si = (row + xx) * 4;
        const w = weights[k + radius];
        r += src[si] * w;
        g += src[si + 1] * w;
        b += src[si + 2] * w;
      }
      const ti = (row + x) * 3;
      tmp[ti] = r;
      tmp[ti + 1] = g;
      tmp[ti + 2] = b;
    }
  }
  // Vertical pass + unsharp combine
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -radius; k <= radius; k++) {
        let yy = y + k;
        if (yy < 0) yy = 0;
        else if (yy >= height) yy = height - 1;
        const ti = (yy * width + x) * 3;
        const w = weights[k + radius];
        r += tmp[ti] * w;
        g += tmp[ti + 1] * w;
        b += tmp[ti + 2] * w;
      }
      const i = (y * width + x) * 4;
      out[i] = src[i] + amount * (src[i] - r);
      out[i + 1] = src[i + 1] + amount * (src[i + 1] - g);
      out[i + 2] = src[i + 2] + amount * (src[i + 2] - b);
      out[i + 3] = src[i + 3];
    }
  }
  return out;
}

/**
 * Runs the full pixel pipeline of a render plan (tone → kernels → unsharp) and returns a new buffer.
 * Text shadows / spacing are not applicable to raster content and are ignored.
 */
export function compensatePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  plan: Pick<RenderPlan, 'active' | 'tone' | 'kernels'> & Partial<Pick<RenderPlan, 'unsharp'>>,
  /** Pixels per CSS px of this buffer (e.g. `devicePixelRatio` for a HiDPI canvas). Default 1. */
  pixelRatio = 1,
): Uint8ClampedArray {
  let buf: Uint8ClampedArray = new Uint8ClampedArray(data);
  if (!plan.active) return buf;
  if (plan.tone) toneMapRGBA(buf, plan.tone.slope, plan.tone.intercept);
  for (const kernel of plan.kernels) buf = convolveRGBA(buf, width, height, kernel.matrix);
  if (plan.unsharp) buf = unsharpRGBA(buf, width, height, plan.unsharp.sigma * pixelRatio, plan.unsharp.amount);
  return buf;
}
