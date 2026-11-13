// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EyesFree, memoryAdapter } from '@eyesfree/web';
import { CALIBRATOR_EVENTS, defineCalibrator, openCalibratorDialog, resolveLocale, sizeOptionsAround } from '@eyesfree/calibrator';
import type { EyesFreeCalibratorElement } from '@eyesfree/calibrator';

defineCalibrator();

const mount = (attrs: Record<string, string> = {}) => {
  const el = document.createElement('eyesfree-calibrator') as EyesFreeCalibratorElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
};
const click = (el: Element | null) => (el as HTMLElement).click();
const next = (el: EyesFreeCalibratorElement) => click(el.querySelector('[data-action="next"]'));
const slide = (el: EyesFreeCalibratorElement, name: string, value: number) => {
  const input = el.querySelector<HTMLInputElement>(`input[data-input="${name}"]`)!;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const zoomOf = (el: EyesFreeCalibratorElement) => /zoom:\s*([\d.]+)/.exec(el.querySelector('.efc')!.getAttribute('style') ?? '')?.[1] ?? '';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<eyesfree-calibrator>', () => {
  it('step 1 asks for the distance and suggests the magnification', () => {
    const el = mount();
    expect(el.querySelectorAll('[data-distance]')).toHaveLength(7);
    expect(el.querySelector('.efc-distance-letters')).not.toBeNull();
    expect(zoomOf(el)).toBe(''); // step 1 is read up close, unmagnified
    click(el.querySelector('[data-distance="100"]'));
    expect(el.profile).toMatchObject({ viewingDistance: 100, fontScale: 2.5, sharpness: 'none' });
  });

  it('step 2 magnifies the wizard itself and shows sizes at true size', () => {
    const el = mount();
    click(el.querySelector('[data-distance="100"]'));
    next(el);
    expect(el.step).toBe(2);
    expect(zoomOf(el)).toBe('2.5');
    expect(Array.from(el.querySelectorAll<HTMLElement>('[data-size]')).map((b) => Number(b.dataset.size))).toEqual(
      sizeOptionsAround(2.5),
    );
    // 3× chosen, inside a 2.5× zoomed wizard → 1.2rem before zoom = 3rem on screen
    expect(el.querySelector<HTMLElement>('[data-preview-size="3"]')!.style.fontSize).toMatch(/^calc\(1(\.2)?rem( \* 1\.2)?\)$|^calc\(1\.2rem\)$/);
    expect(el.querySelector('[data-size="2.5"]')!.getAttribute('aria-checked')).toBe('true');
  });

  it('can apply right after choosing the size (no fine-tuning needed)', () => {
    const el = mount();
    const complete = vi.fn();
    el.addEventListener(CALIBRATOR_EVENTS.complete, complete);
    click(el.querySelector('[data-distance="130"]'));
    next(el);
    click(el.querySelector('[data-size="3.75"]'));
    click(el.querySelector('[data-action="apply"]'));
    expect(complete.mock.calls[0]![0].detail.profile).toMatchObject({ viewingDistance: 130, fontScale: 3.75, sharpness: 'none' });
  });

  it('optional step 3 previews large-radius sharpening that follows the blur slider', () => {
    const el = mount();
    next(el);
    next(el);
    expect(el.step).toBe(3);
    click(el.querySelector('[data-sharpness="medium"]'));
    const medium = el.querySelector<HTMLElement>('[data-preview-sharpness="medium"]')!;
    expect(medium.style.filter).toMatch(/^url\(#efc\d+-sharp-medium\)$/);
    const filterId = medium.style.filter.slice(5, -1);
    const blur = () => document.querySelector(`filter#${filterId} feGaussianBlur`)!.getAttribute('stdDeviation');
    expect(blur()).toBe('3');
    expect(document.querySelector(`filter#${filterId} feFlood`)).not.toBeNull();
    slide(el, 'radius', 7); // BLUR_RADIUS_STEPS[7] = 6
    expect(el.profile.blurRadius).toBe(6);
    expect(blur()).toBe('6');
    expect(el.querySelector<HTMLElement>('[data-preview-sharpness="none"]')!.style.filter).toBe('');
  });

  it('walks all four steps and emits the chosen profile', () => {
    const el = mount();
    const change = vi.fn();
    const complete = vi.fn();
    el.addEventListener(CALIBRATOR_EVENTS.change, change);
    el.addEventListener(CALIBRATOR_EVENTS.complete, complete);

    click(el.querySelector('[data-distance="70"]'));
    next(el);
    click(el.querySelector('[data-size="2.25"]'));
    next(el);
    slide(el, 'radius', 5);
    click(el.querySelector('[data-sharpness="strong"]'));
    next(el);
    expect(el.step).toBe(4);
    click(el.querySelector('[data-ghost="vertical"]'));
    slide(el, 'crowding', 3);
    expect(el.querySelector('[data-spacing-label]')!.textContent).toBe('Wide');
    click(el.querySelector('[data-action="apply"]'));

    expect(change).toHaveBeenCalled();
    expect(complete.mock.calls[0]![0].detail.profile).toMatchObject({
      viewingDistance: 70,
      fontScale: 2.25,
      blurRadius: 4,
      sharpness: 'strong',
      ghostAxis: 'vertical',
      crowding: 3,
      enabled: true,
    });
  });

  it('back navigates to the previous step', () => {
    const el = mount();
    next(el);
    next(el);
    click(el.querySelector('[data-action="back"]'));
    expect(el.step).toBe(2);
  });

  it('applies the result through an engine', async () => {
    const engine = new EyesFree({ storage: memoryAdapter(), sync: false });
    await engine.init();
    const el = mount();
    el.engine = engine;
    click(el.querySelector('[data-distance="100"]'));
    next(el);
    click(el.querySelector('[data-action="apply"]'));
    expect(engine.getProfile()).toMatchObject({ fontScale: 2.5, viewingDistance: 100 });
    expect(engine.isActive()).toBe(true);
  });

  it('suspends the engine during a session and resumes on cancel', async () => {
    const engine = new EyesFree({ storage: false, sync: false });
    await engine.init();
    engine.apply({ sharpness: 'strong' });
    const el = mount();
    el.engine = engine;
    el.start();
    el.start(); // idempotent
    expect(engine.isSuspended()).toBe(true);
    expect(el.profile.sharpness).toBe('strong'); // starts from the current profile
    el.cancel();
    expect(engine.isSuspended()).toBe(false);
    expect(engine.isActive()).toBe(true);
  });

  it('supports arrow-key navigation (roving tabindex)', () => {
    const el = mount();
    const first = el.querySelector<HTMLElement>('[data-distance="40"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(el.profile.viewingDistance).toBe(50);
    expect(el.querySelector<HTMLElement>('[data-distance="50"]')!.tabIndex).toBe(0);
  });

  it('localises and escapes custom text', () => {
    const el = mount({ locale: 'pt-BR', 'sample-letters': '<b>X</b>' });
    expect(el.textContent).toContain('Passo 1 de 4');
    expect(el.textContent).toContain('Cerca de 1 m');
    expect(el.innerHTML).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(resolveLocale('es-MX').next).toBe('Continuar');
    expect(resolveLocale('xx').next).toBe('Continue');
  });

  it('emits cancel', () => {
    const el = mount();
    const cancel = vi.fn();
    el.addEventListener(CALIBRATOR_EVENTS.cancel, cancel);
    click(el.querySelector('[data-action="cancel"]'));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('opens in a dialog and resolves with the profile', async () => {
    const handle = openCalibratorDialog();
    expect(document.querySelector('dialog.efc-dialog')).not.toBeNull();
    click(handle.element.querySelector('[data-distance="100"]'));
    click(handle.element.querySelector('[data-action="next"]'));
    click(handle.element.querySelector('[data-action="apply"]'));
    const profile = await handle.result;
    expect(profile?.fontScale).toBe(2.5);
    expect(document.querySelector('dialog.efc-dialog')).toBeNull();
  });
});
