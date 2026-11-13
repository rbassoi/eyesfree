// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAMERA_FOV_DEG,
  distanceFromSize,
  distanceStatus,
  FaceDistanceEstimator,
  focalLengthPx,
  IRIS_DIAMETER_MM,
  nearestDistance,
} from '@eyesfree/core';
import type { FaceMeasurement } from '@eyesfree/core';
import { EyesFree } from '@eyesfree/web';
import { CALIBRATOR_EVENTS, defineCalibrator } from '@eyesfree/calibrator';
import type { EyesFreeCalibratorElement } from '@eyesfree/calibrator';
import { candidateRegions, createDistanceGuard, DistanceMonitor, LANDMARKS, measureFromLandmarks } from '@eyesfree/distance';
import type { FaceSource } from '@eyesfree/distance';

const W = 1280;
const F = focalLengthPx(W, CAMERA_FOV_DEG.laptop);
/** Synthetic measurement of a face with a 66 mm IPD at `cm`. */
const faceAt = (cm: number, ipdMm = 66): FaceMeasurement => ({
  imageWidthPx: W,
  ipdPx: (F * ipdMm) / (cm * 10),
  irisDiameterPx: (F * IRIS_DIAMETER_MM) / (cm * 10),
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('distance maths (core)', () => {
  it('pinhole model round-trips', () => {
    expect(distanceFromSize((F * 63) / 1000, 63, F)).toBeCloseTo(100, 6);
    expect(Number.isNaN(distanceFromSize(0, 63, F))).toBe(true);
  });

  it('learns the user IPD up close, then stays accurate far away', () => {
    const naive = new FaceDistanceEstimator({ smoothing: 1 });
    // At 1.2 m the iris (~10 px) is too small; with the default 63 mm IPD a 66 mm face reads ~5 % short.
    expect(naive.update(faceAt(120))!.cm).toBe(115);

    const learned = new FaceDistanceEstimator({ smoothing: 1 });
    for (let i = 0; i < 10; i++) learned.update(faceAt(40)); // iris ~19 px: reliable
    expect(learned.learnedIpdMm).toBeCloseTo(66, 0);
    const far = learned.update(faceAt(120))!;
    expect(far.method).toBe('ipd');
    expect(far.cm).toBe(120);
  });

  it('calibration fixes a wrong field-of-view guess', () => {
    const e = new FaceDistanceEstimator({ fovDeg: 90, smoothing: 1 }); // badly wrong FOV
    expect(Math.abs(e.update(faceAt(50))!.cm - 50)).toBeGreaterThan(10);
    e.calibrate(faceAt(50), 50);
    expect(e.update(faceAt(80))!.cm).toBe(80);
  });

  it('classifies distance against the target', () => {
    expect(distanceStatus(70, 100)).toBe('too-close');
    expect(distanceStatus(95, 100)).toBe('ok');
    expect(distanceStatus(200, 100)).toBe('too-far');
    expect(nearestDistance(92, [40, 50, 70, 100, 130])).toBe(100);
  });
});

describe('MediaPipe landmark adapter', () => {
  it('searches face-sized square crops so faces 1 m+ away are found', () => {
    const [full, centre, scan0] = candidateRegions(1280, 720, null, 0);
    expect(full).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
    expect(centre).toEqual({ x: 460, y: 180, w: 360, h: 360 });
    expect(scan0).toEqual({ x: 33, y: 0, w: 360, h: 360 });
    // known small face (IPD 40 px ≈ 1.7 m) → 240 px square around it first, clamped in frame
    expect(candidateRegions(1280, 720, { cx: 100, cy: 60, ipdPx: 40 })[0]).toEqual({ x: 0, y: 0, w: 240, h: 240 });
    // big face → full frame only
    expect(candidateRegions(1280, 720, { cx: 640, cy: 360, ipdPx: 200 })).toEqual([full]);
  });

  it('converts normalised iris landmarks to pixels', () => {
    const lm: { x: number; y: number }[] = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
    lm[LANDMARKS.rightIrisCenter] = { x: 0.4, y: 0.5 };
    lm[LANDMARKS.leftIrisCenter] = { x: 0.5, y: 0.5 };
    lm[LANDMARKS.rightIrisEdges[0]] = { x: 0.39, y: 0.5 };
    lm[LANDMARKS.rightIrisEdges[1]] = { x: 0.41, y: 0.5 };
    lm[LANDMARKS.leftIrisEdges[0]] = { x: 0.49, y: 0.5 };
    lm[LANDMARKS.leftIrisEdges[1]] = { x: 0.51, y: 0.5 };
    const m = measureFromLandmarks(lm, 1000, 500)!;
    expect(m.ipdPx).toBeCloseTo(100);
    expect(m.irisDiameterPx).toBeCloseTo(20);
  });
});

/** Fake detector that reports a face at a controllable distance. */
const fakeSource = (state: { cm: number | null }): FaceSource => ({
  init: async () => undefined,
  measure: () => (state.cm === null ? null : faceAt(state.cm)),
  close: () => undefined,
});
const fakeCamera = async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('DistanceMonitor', () => {
  it('measures from frames, reports no-face, and releases the camera on stop', async () => {
    const state = { cm: 80 as number | null };
    const stopTrack = vi.fn();
    const monitor = new DistanceMonitor({
      source: fakeSource(state),
      intervalMs: 5,
      camera: async () => ({ getTracks: () => [{ stop: stopTrack }] }) as unknown as MediaStream,
    });
    // jsdom's <video> has no frames; feed measurements through the public push() path instead.
    await monitor.start();
    expect(monitor.running).toBe(true);
    for (let i = 0; i < 30; i++) monitor.push(faceAt(80));
    expect(monitor.getReading().status).toBe('measuring');
    expect(monitor.getReading().cm).toBeGreaterThan(70);
    for (let i = 0; i < 8; i++) monitor.push(null);
    expect(monitor.getReading().status).toBe('no-face');
    monitor.stop();
    expect(stopTrack).toHaveBeenCalled();
    expect(monitor.running).toBe(false);
  });

  it('surfaces camera permission errors', async () => {
    const monitor = new DistanceMonitor({
      source: fakeSource({ cm: 50 }),
      camera: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
    });
    await expect(monitor.start()).rejects.toThrow('denied');
    expect(monitor.getReading().status).toBe('error');
  });
});

describe('createDistanceGuard', () => {
  it('warns when closer than the calibrated distance, magnified with the profile', async () => {
    const engine = new EyesFree({ storage: false, sync: false });
    await engine.init();
    engine.apply({ viewingDistance: 100, fontScale: 2.5 });
    const monitor = new DistanceMonitor({ source: fakeSource({ cm: 70 }), camera: fakeCamera, intervalMs: 1000 });
    const remove = createDistanceGuard({ engine, monitor, locale: 'pt-BR' });
    await monitor.start();
    for (let i = 0; i < 30; i++) monitor.push(faceAt(70));
    const pill = document.querySelector<HTMLElement>('.eyesfree-guard')!;
    expect(pill.hidden).toBe(false);
    expect(pill.dataset.status).toBe('too-close');
    expect(pill.textContent).toContain('Afaste-se');
    expect(pill.style.fontSize).toMatch(/2\.75rem|2\.5/); // 1.1rem × fontScale 2.5
    for (let i = 0; i < 60; i++) monitor.push(faceAt(100));
    expect(pill.dataset.status).toBe('ok');
    monitor.stop();
    remove();
    expect(document.querySelector('.eyesfree-guard')).toBeNull();
  });
});

describe('calibrator camera step', () => {
  defineCalibrator();
  it('selects the distance from the camera reading', async () => {
    const monitor = new DistanceMonitor({ source: fakeSource({ cm: 95 }), camera: fakeCamera, intervalMs: 1000 });
    const el = document.createElement('eyesfree-calibrator') as EyesFreeCalibratorElement;
    el.distanceMonitor = monitor;
    document.body.appendChild(el);
    el.start();
    const change = vi.fn();
    el.addEventListener(CALIBRATOR_EVENTS.change, change);
    (el.querySelector('[data-action="camera"]') as HTMLElement).click();
    await wait(10);
    for (let i = 0; i < 30; i++) monitor.push(faceAt(95));
    expect(el.querySelector('[data-measured]')!.textContent).toMatch(/95 cm/);
    expect(el.profile).toMatchObject({ viewingDistance: 100, fontScale: 2.5 });
    expect(change.mock.calls.length).toBeLessThan(5); // not re-emitted on every frame
    // Leaving step 1 turns the camera off (the calibrator started it).
    (el.querySelector('[data-action="next"]') as HTMLElement).click();
    expect(monitor.running).toBe(false);
  });
});
