// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compensatePixels, createRenderPlan, encodeProfile, normalizeProfile } from '@eyesfree/core';
import {
  CLASSES,
  createWorkerSource,
  CSS_VARS,
  DEFS_ID,
  DOM_CHANGE_EVENT,
  EyesFree,
  filterMarkup,
  ImageCompensator,
  memoryAdapter,
  STYLE_ELEMENT_ID,
} from '@eyesfree/web';

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.body.className = '';
  document.body.removeAttribute('style');
  history.replaceState(null, '', '/');
});

describe('EyesFree engine', () => {
  it('renders classes, variables, styles and the SVG filter', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ef = new EyesFree({ root, storage: memoryAdapter(), sync: false });
    await ef.init();
    expect(ef.isActive()).toBe(false);

    ef.apply({ ghostAxis: 'horizontal', sharpness: 'medium', crowding: 2 });
    expect(root.classList.contains(CLASSES.active)).toBe(true);
    expect(root.classList.contains(CLASSES.scopeRoot)).toBe(true);
    expect(root.style.getPropertyValue(CSS_VARS.filter)).toBe('url(#eyesfree-filter)');
    expect(root.style.getPropertyValue(CSS_VARS.letterSpacing)).toBe('0.065em');
    expect(document.getElementById(STYLE_ELEMENT_ID)).not.toBeNull();

    const filter = document.querySelector(`#${DEFS_ID} filter#eyesfree-filter`)!;
    expect(filter).not.toBeNull();
    expect(filter.querySelector('feComponentTransfer')).not.toBeNull();
    const kernels = Array.from(filter.querySelectorAll('feConvolveMatrix')).map((n) => n.getAttribute('kernelMatrix'));
    expect(kernels).toEqual(['0 0 0 -1.1 3.2 -1.1 0 0 0']);
    // large-radius unsharp mask chained after the kernel
    expect(filter.querySelector('feGaussianBlur')!.getAttribute('stdDeviation')).toBe('3');
    const comp = filter.querySelector('feComposite')!;
    expect([comp.getAttribute('k2'), comp.getAttribute('k3')]).toEqual(['2', '-1']);
    expect(comp.getAttribute('in')).toBe(filter.querySelector('feConvolveMatrix')!.getAttribute('result'));
    expect(root.style.getPropertyValue(CSS_VARS.textStroke)).toBe('0.3px');
  });

  it('magnifies text with zoom on the root children (opt-out with magnify: false)', async () => {
    const ef = new EyesFree({ storage: false, sync: false });
    await ef.init();
    ef.apply({ fontScale: 1.5 });
    expect(document.body.classList.contains(CLASSES.zoom)).toBe(true);
    expect(document.body.style.getPropertyValue(CSS_VARS.fontScale)).toBe('1.5');
    ef.apply({ fontScale: 1 });
    expect(document.body.classList.contains(CLASSES.zoom)).toBe(false);
    const ef2 = new EyesFree({ storage: false, sync: false, magnify: false });
    await ef2.init();
    ef2.apply({ fontScale: 1.5 });
    expect(document.body.classList.contains(CLASSES.zoom)).toBe(false);
  });

  it('persists and restores through storage', async () => {
    const storage = memoryAdapter();
    const a = new EyesFree({ storage, sync: false });
    await a.init();
    a.apply({ sharpness: 'strong' });
    await flush();
    expect(storage.dump()['eyesfree:profile']).toContain('"strong"');

    a.destroy();
    const b = new EyesFree({ storage, sync: false });
    const restored = await b.init();
    expect(restored?.sharpness).toBe('strong');
    expect(document.body.classList.contains(CLASSES.active)).toBe(true);
  });

  it('disable keeps the profile, reset forgets it', async () => {
    const storage = memoryAdapter();
    const ef = new EyesFree({ storage, sync: false });
    await ef.init();
    ef.apply({ sharpness: 'mild' });
    ef.disable();
    expect(ef.isActive()).toBe(false);
    expect(ef.getProfile()?.sharpness).toBe('mild');
    expect(document.body.classList.contains(CLASSES.active)).toBe(false);
    expect(document.getElementById('eyesfree-filter')).toBeNull();

    ef.toggle();
    expect(ef.isActive()).toBe(true);

    ef.reset();
    await flush();
    expect(ef.getProfile()).toBeNull();
    expect(storage.dump()).toEqual({});
  });

  it('reads a profile code from the URL', async () => {
    const code = encodeProfile(normalizeProfile({ ghostAxis: 'vertical', sharpness: 'mild' }));
    history.replaceState(null, '', `/?eyesfree=${code}`);
    const ef = new EyesFree({ storage: memoryAdapter(), sync: false });
    const p = await ef.init();
    expect(p?.ghostAxis).toBe('vertical');
    expect(ef.getShareUrl('https://app.example/x')).toBe(`https://app.example/x?eyesfree=${code}`);
  });

  it('notifies subscribers, typed listeners and DOM listeners', async () => {
    const ef = new EyesFree({ storage: false, sync: false });
    await ef.init();
    const sub = vi.fn();
    const on = vi.fn();
    const dom = vi.fn();
    ef.subscribe(sub);
    ef.on('change', on);
    document.addEventListener(DOM_CHANGE_EVENT, dom);
    ef.apply({ crowding: 1 });
    expect(sub).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0]![0].source).toBe('apply');
    expect(dom).toHaveBeenCalledTimes(1);
    document.removeEventListener(DOM_CHANGE_EVENT, dom);
  });

  it('opt-in scope and palette surface mode', async () => {
    const ef = new EyesFree({ storage: false, sync: false, scope: 'opt-in', surfaceMode: 'palette' });
    await ef.init();
    ef.apply({ sharpness: 'mild' });
    const root = document.body;
    expect(root.classList.contains(CLASSES.scopeOptIn)).toBe(true);
    expect(root.classList.contains(CLASSES.palette)).toBe(true);
    // palette mode removes tone mapping from the filter
    expect(document.querySelector('#eyesfree-filter feComponentTransfer')).toBeNull();
  });

  it('survives a destroy / init cycle (React StrictMode)', async () => {
    const ef = new EyesFree({ storage: memoryAdapter(), sync: false });
    await ef.init();
    ef.apply({ sharpness: 'mild' });
    ef.destroy();
    expect(document.body.classList.contains(CLASSES.active)).toBe(false);
    await ef.init();
    expect(document.body.classList.contains(CLASSES.active)).toBe(true);
  });

  it('suspend() pauses rendering without changing the profile; suspensions nest', async () => {
    const ef = new EyesFree({ storage: false, sync: false });
    await ef.init();
    ef.apply({ sharpness: 'mild' });
    const r1 = ef.suspend();
    const r2 = ef.suspend();
    expect(document.body.classList.contains(CLASSES.active)).toBe(false);
    expect(ef.getProfile()?.enabled).toBe(true);
    r1();
    r1(); // idempotent
    expect(ef.isSuspended()).toBe(true);
    r2();
    expect(document.body.classList.contains(CLASSES.active)).toBe(true);
  });

  it('produces static filter markup for SSR', () => {
    const html = filterMarkup('x', createRenderPlan({ sharpness: 'mild', blurRadius: 0 }));
    expect(html).toContain('<filter id="x"');
    expect(html).toContain('kernelMatrix="0 -0.55 0 -0.55 3.2 -0.55 0 -0.55 0"');
    expect(filterMarkup('y', createRenderPlan({ sharpness: 'mild' }))).toContain('<feGaussianBlur in="ef0" stdDeviation="3" result="ef1"/>');
  });
});

describe('ImageCompensator', () => {
  const W = 5;
  const H = 4;
  const image = () => {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const v = (i % W) * 60;
      data.set([v, v, v, 255], i * 4);
    }
    return { data, width: W, height: H };
  };

  it('falls back to the main thread and matches the core pipeline', async () => {
    const c = new ImageCompensator();
    expect(c.usesWorker).toBe(false); // jsdom has no Worker
    const plan = createRenderPlan({ ghostAxis: 'diagonal45', sharpness: 'strong' });
    const out = await c.process(image(), plan);
    expect(Array.from(out.data)).toEqual(Array.from(compensatePixels(image().data, W, H, plan)));
  });

  it('worker source is self-contained and bit-identical to core', () => {
    const posted: Array<{ id: number; buffer: ArrayBuffer }> = [];
    const self: { onmessage?: (e: { data: unknown }) => void; postMessage: (m: never) => void } = {
      postMessage: (m) => void posted.push(m),
    };
    // Evaluate the worker in an isolated scope with a fake `self`.
    new Function('self', createWorkerSource())(self);
    const plan = createRenderPlan({ ghostAxis: 'vertical', sharpness: 'medium' });
    const img = image();
    self.onmessage!({
      data: {
        id: 7,
        width: W,
        height: H,
        buffer: new Uint8ClampedArray(img.data).buffer,
        tone: plan.tone,
        kernels: plan.kernels.map((k) => k.matrix),
        unsharp: plan.unsharp,
      },
    });
    expect(posted[0]!.id).toBe(7);
    expect(Array.from(new Uint8ClampedArray(posted[0]!.buffer))).toEqual(Array.from(compensatePixels(img.data, W, H, plan)));
  });

  it('returns an untouched copy for inactive plans', async () => {
    const img = image();
    const out = await new ImageCompensator({ mode: 'main-thread' }).process(img, { enabled: false });
    expect(out.data).not.toBe(img.data);
    expect(Array.from(out.data)).toEqual(Array.from(img.data));
  });
});
