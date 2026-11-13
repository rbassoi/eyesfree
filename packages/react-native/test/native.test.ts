import { describe, expect, it } from 'vitest';
import { createRenderPlan } from '@eyesfree/core';
import { EyesFreeNativeStore } from '../src/store.js';
import { boostFontWeight, nativeSurfaceStyle, nativeTextStyle } from '../src/style.js';

const asyncStorage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
    removeItem: async (k: string) => void data.delete(k),
  };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('@eyesfree/react-native', () => {
  it('converts a plan into RN text styles', () => {
    const style = nativeTextStyle(createRenderPlan({ ghostAxis: 'horizontal', sharpness: 'medium', crowding: 2, fontScale: 1.5 }), {
      fontSize: 20,
      fontWeight: 'bold',
    });
    expect(style.fontSize).toBe(30);
    expect(style.letterSpacing).toBeCloseTo(0.065 * 30, 2);
    expect(style.fontWeight).toBe('900');
    expect(style.textShadowOffset).toEqual({ width: -1.3, height: 0 });
    expect(style.textShadowRadius).toBe(1);
    expect(nativeTextStyle(createRenderPlan(null))).toEqual({});
  });

  it('boosts font weights within bounds', () => {
    expect(boostFontWeight(undefined, 200)).toBe('600');
    expect(boostFontWeight('800', 300)).toBe('900');
    expect(boostFontWeight('normal', 0)).toBe('normal');
  });

  it('surface style follows surface compensation', () => {
    expect(nativeSurfaceStyle(createRenderPlan({ sharpness: 'mild' }))).toEqual({ backgroundColor: '#E4E7EC' });
    expect(nativeSurfaceStyle(createRenderPlan({ sharpness: 'mild', surfaceCompensation: false }))).toEqual({});
  });

  it('store persists, restores and resets', async () => {
    const storage = asyncStorage();
    const a = new EyesFreeNativeStore(storage);
    await a.init();
    a.apply({ sharpness: 'strong' });
    await flush();
    expect(storage.data.get('eyesfree:profile')).toContain('strong');

    const b = new EyesFreeNativeStore(storage);
    expect((await b.init())?.sharpness).toBe('strong');
    expect(b.getShareCode()).toMatch(/^EF1\./);

    b.reset();
    await flush();
    expect(storage.data.size).toBe(0);
  });

  it('uses an initial profile code (deep link) when nothing is stored', async () => {
    const s = new EyesFreeNativeStore(null);
    const p = await s.init('EF1.vl111.100.100');
    expect(p).toMatchObject({ ghostAxis: 'vertical', sharpness: 'mild', crowding: 1 });
  });
});

describe('@eyesfree/react-native distance helpers', () => {
  it('turns eye positions into a distance with the phone estimator', async () => {
    const { measurementFromEyes, createPhoneDistanceEstimator } = await import('../src/distance-math.js');
    const { focalLengthPx, CAMERA_FOV_DEG } = await import('@eyesfree/core');
    const f = focalLengthPx(720, CAMERA_FOV_DEG.phoneFront);
    const ipdPx = (f * 63) / 450; // 63 mm IPD at 45 cm
    const m = measurementFromEyes({ x: 300, y: 400 }, { x: 300 + ipdPx, y: 400 }, 720);
    expect(createPhoneDistanceEstimator({ smoothing: 1 }).update(m)!.cm).toBe(45);
  });
});
