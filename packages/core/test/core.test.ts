import { describe, expect, it } from 'vitest';
import {
  compensatePixels,
  convolveRGBA,
  createProfile,
  createRenderPlan,
  decodeProfile,
  deconvolutionKernel,
  DEFAULT_PROFILE,
  directionalKernel,
  directionalShadows,
  encodeProfile,
  ghostKernel,
  ghostShadows,
  identityKernel,
  kernelSum,
  normalizeProfile,
  parseProfile,
  profilesEqual,
  serializeProfile,
  SHARPNESS_PRESETS,
  shadowsToCss,
  suggestFontScale,
  unsharpRGBA,
  validateProfile,
} from '@eyesfree/core';
import type { VisionProfile } from '@eyesfree/core';

describe('kernels', () => {
  it('reproduces the original prototype deconvolution kernels', () => {
    expect(deconvolutionKernel(0.55).matrix).toEqual([0, -0.55, 0, -0.55, 3.2, -0.55, 0, -0.55, 0]);
    expect(deconvolutionKernel(0.95).matrix).toEqual([0, -0.95, 0, -0.95, 4.8, -0.95, 0, -0.95, 0]);
    expect(deconvolutionKernel(1.15, 0.25).matrix).toEqual([-0.25, -1.15, -0.25, -1.15, 6.6, -1.15, -0.25, -1.15, -0.25]);
  });

  it('reproduces the original prototype directional kernels', () => {
    expect(directionalKernel(0, 1.1).matrix).toEqual([0, 0, 0, -1.1, 3.2, -1.1, 0, 0, 0]);
    expect(directionalKernel(90, 1.1).matrix).toEqual([0, -1.1, 0, 0, 3.2, 0, 0, -1.1, 0]);
    // prototype "diag1": corners top-left / bottom-right (↖↘ line = 135°)
    expect(directionalKernel(135, 1).matrix).toEqual([-1, 0, 0, 0, 3, 0, 0, 0, -1]);
    // prototype "diag2": corners top-right / bottom-left (↗↙ line = 45°)
    expect(directionalKernel(45, 1).matrix).toEqual([0, 0, -1, 0, 3, 0, -1, 0, 0]);
  });

  it('keeps every kernel brightness-preserving (sum = 1)', () => {
    for (const { k, d } of Object.values(SHARPNESS_PRESETS)) expect(kernelSum(deconvolutionKernel(k, d))).toBe(1);
    for (let a = 0; a < 360; a += 7.5) expect(kernelSum(directionalKernel(a, 1.1))).toBe(1);
  });

  it('distributes arbitrary angles between neighbouring cells', () => {
    const m = directionalKernel(22.5, 1).matrix;
    // taps split between right (5) and top-right (2), and mirrored left (3) / bottom-left (6)
    expect(m[5]).toBeLessThan(0);
    expect(m[2]).toBeLessThan(0);
    expect(m[3]).toBeCloseTo(m[5]!, 4);
    expect(m[6]).toBeCloseTo(m[2]!, 4);
  });

  it('never emits negative zero', () => {
    for (const w of directionalKernel(90, 1.1).matrix) expect(Object.is(w, -0)).toBe(false);
  });
});

describe('shadows', () => {
  it('reproduces the prototype ghost-cancellation shadows', () => {
    expect(shadowsToCss(ghostShadows('horizontal'))).toBe('-1.3px 0px 0px rgba(255,255,255,0.95), 1.1px 0px 0px rgba(0,0,0,0.45)');
    expect(shadowsToCss(ghostShadows('vertical'))).toBe('0px -1.3px 0px rgba(255,255,255,0.95), 0px 1.1px 0px rgba(0,0,0,0.45)');
    expect(shadowsToCss(ghostShadows('diagonal135'))).toBe('-1.2px -1.2px 0px rgba(255,255,255,0.95), 1px 1px 0px rgba(0,0,0,0.45)');
    expect(shadowsToCss(ghostShadows('diagonal45'))).toBe('1.2px -1.2px 0px rgba(255,255,255,0.95), -1px 1px 0px rgba(0,0,0,0.45)');
    expect(ghostShadows('outline')).toHaveLength(4);
    expect(shadowsToCss(ghostShadows('none'))).toBe('none');
  });

  it('places light and dark shadows on opposite sides for any angle', () => {
    const [light, dark] = directionalShadows(30);
    expect(Math.sign(light!.x)).toBe(-Math.sign(dark!.x));
    expect(Math.sign(light!.y)).toBe(-Math.sign(dark!.y));
  });
});

describe('profile', () => {
  it('normalises garbage into a valid default profile', () => {
    const p = normalizeProfile({ ghostAxis: 'sideways', crowding: 9, intensity: 99, fontScale: -1 });
    expect(validateProfile(p).valid).toBe(true);
    expect(p.ghostAxis).toBe(DEFAULT_PROFILE.ghostAxis);
    expect(p.crowding).toBe(DEFAULT_PROFILE.crowding);
    expect(p.intensity).toBe(2);
    expect(p.fontScale).toBe(1);
  });

  it('migrates profiles saved by the original prototype', () => {
    const legacy = { ghostAxis: 'diag1', sharpnessLevel: 'strong', crowdingLevel: 3, simulatingEyeBlur: false };
    const p = normalizeProfile(legacy);
    expect(p.ghostAxis).toBe('diagonal135');
    expect(p.sharpness).toBe('strong');
    expect(p.crowding).toBe(3);
  });

  it('validates strictly and reports every problem', () => {
    const r = validateProfile({ version: 2, enabled: 'yes' });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(3);
  });

  it('compares profiles ignoring updatedAt', () => {
    const a = createProfile({ sharpness: 'mild' });
    const b = { ...a, updatedAt: '2000-01-01T00:00:00.000Z' };
    expect(profilesEqual(a, b)).toBe(true);
    expect(profilesEqual(a, { ...a, crowding: 0 })).toBe(false);
  });
});

describe('codec', () => {
  const sample: VisionProfile = {
    version: 1,
    enabled: true,
    ghostAxis: 'diagonal45',
    sharpness: 'strong',
    blurRadius: 2.5,
    crowding: 3,
    intensity: 1.25,
    surfaceCompensation: false,
    fontScale: 1.4,
    viewingDistance: 100,
  };

  it('round-trips every field', () => {
    const code = encodeProfile(sample);
    expect(code).toBe('EF1.as301.125.140.250.100');
    expect(decodeProfile(code)).toEqual(sample);
  });

  it('still decodes 0.1 codes (no blur-radius segment) with the default radius', () => {
    expect(decodeProfile('EF1.as301.125.140')).toEqual({ ...sample, blurRadius: DEFAULT_PROFILE.blurRadius, viewingDistance: 0 });
    expect(decodeProfile('EF1.as301.125.140.250')).toEqual({ ...sample, viewingDistance: 0 });
    expect(decodeProfile('EF1.as301.125.400.250.100')?.fontScale).toBe(4);
    expect(decodeProfile('EF1.as301.125.140.250.999')).toBeNull(); // distance > 300 cm
    expect(decodeProfile('EF1.nm211.100.100.1300')).toBeNull(); // radius 13 > 12
  });

  it('rejects malformed or out-of-range codes', () => {
    expect(decodeProfile('EF1.xx000.100.100')).toBeNull();
    expect(decodeProfile('EF1.nm211.900.100')).toBeNull();
    expect(decodeProfile('nope')).toBeNull();
  });

  it('parses JSON, codes and objects', () => {
    expect(parseProfile(serializeProfile(sample))).toEqual(sample);
    expect(parseProfile(encodeProfile(sample))).toEqual(sample);
    expect(parseProfile({ sharpness: 'mild' })?.sharpness).toBe('mild');
    expect(parseProfile('')).toBeNull();
    expect(parseProfile('{broken')).toBeNull();
    expect(parseProfile(null)).toBeNull();
  });
});

describe('distance mode', () => {
  it('suggests the magnification that keeps the normal angular size', () => {
    expect(suggestFontScale(100)).toBe(2.5); // validated by a +2.50 reader: sharp at 1 m with 250 %
    expect(suggestFontScale(70)).toBe(1.75);
    expect(suggestFontScale(200)).toBe(4); // clamped
    expect(suggestFontScale(0)).toBe(1);
  });

  it('carries the viewing distance into the plan', () => {
    expect(createRenderPlan({ viewingDistance: 130, fontScale: 3.25 })).toMatchObject({ viewingDistanceCm: 130, fontScale: 3.25 });
    expect(normalizeProfile({ fontScale: 9, viewingDistance: 999 })).toMatchObject({ fontScale: 4, viewingDistance: 300 });
  });
});

describe('render plan', () => {
  it('is inactive for null or disabled profiles', () => {
    expect(createRenderPlan(null).active).toBe(false);
    expect(createRenderPlan({ enabled: false }).active).toBe(false);
  });

  it('orders kernels: directional first, then isotropic (legacy blurRadius 0)', () => {
    const plan = createRenderPlan({ ghostAxis: 'horizontal', sharpness: 'medium', blurRadius: 0 });
    expect(plan.kernels).toHaveLength(2);
    expect(plan.kernels[0]).toEqual(ghostKernel('horizontal'));
    expect(plan.kernels[1]).toEqual(deconvolutionKernel(0.95));
  });

  it('adds tone mapping only when there is something to give headroom to', () => {
    expect(createRenderPlan({ ghostAxis: 'none', sharpness: 'none' }).tone).toBeNull();
    expect(createRenderPlan({ sharpness: 'mild' }).tone).not.toBeNull();
    expect(createRenderPlan({ sharpness: 'mild', surfaceCompensation: false }).tone).toBeNull();
  });

  it('scales strength with intensity', () => {
    const k = createRenderPlan({ sharpness: 'mild', intensity: 2, blurRadius: 0 }).kernels[0]!;
    expect(k.matrix[1]).toBeCloseTo(-1.1);
    expect(createRenderPlan({ sharpness: 'mild', intensity: 2 }).unsharp).toEqual({ sigma: 3, amount: 1.2 });
  });

  it('uses a large-radius unsharp mask sized to the blur, plus stroke and magnification', () => {
    const plan = createRenderPlan({ sharpness: 'strong', blurRadius: 5, fontScale: 1.5 });
    expect(plan.kernels).toHaveLength(0);
    expect(plan.unsharp).toEqual({ sigma: 5, amount: 1.5 });
    expect(plan.textStrokePx).toBe(0.45);
    expect(plan.fontScale).toBe(1.5);
    expect(createRenderPlan({ sharpness: 'none', blurRadius: 5 }).unsharp).toBeNull();
  });
});

describe('pixels', () => {
  const W = 4;
  const H = 3;
  const img = () => {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const v = i % W < 2 ? 0 : 255; // left half black, right half white
      d.set([v, v, v, 200], i * 4);
    }
    return d;
  };

  it('identity kernel is a no-op and alpha is preserved', () => {
    const src = img();
    expect(Array.from(convolveRGBA(src, W, H, identityKernel().matrix))).toEqual(Array.from(src));
  });

  it('sharpening keeps flat areas and saturates the edge', () => {
    const out = convolveRGBA(img(), W, H, deconvolutionKernel(0.95).matrix);
    expect(out[0]).toBe(0); // flat black stays black
    expect(out[(W - 1) * 4]).toBe(255); // flat white stays white
    expect(out[3]).toBe(200); // alpha untouched
  });

  it('unsharp mask keeps flat areas, boosts edges, and is a no-op with amount 0', () => {
    const src = img();
    const out = unsharpRGBA(src, W, H, 1.5, 1);
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(200);
    // pixel just right of the edge (white) overshoots / clips to 255, just left goes to 0
    expect(out[2 * 4]).toBe(255);
    expect(out[1 * 4]).toBe(0);
    expect(Array.from(unsharpRGBA(src, W, H, 2, 0))).toEqual(Array.from(src));
  });

  it('runs the full pipeline without mutating the input', () => {
    const src = img();
    const copy = Array.from(src);
    const out = compensatePixels(src, W, H, createRenderPlan({ sharpness: 'medium', blurRadius: 0 }));
    expect(Array.from(src)).toEqual(copy);
    expect(out[(W - 1) * 4]).toBeLessThanOrEqual(255);
    // tone mapping lifted pure black away from 0 in the flat area
    expect(out[0]).toBeGreaterThan(0);
  });
});
