// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EyesFree, memoryAdapter } from '@eyesfree/web';
import { CALIBRATOR_EVENTS, defineCalibrator, openCalibratorDialog, resolveLocale } from '@eyesfree/calibrator';
import type { EyesFreeCalibratorElement } from '@eyesfree/calibrator';

defineCalibrator();

const mount = (attrs: Record<string, string> = {}) => {
  const el = document.createElement('eyesfree-calibrator') as EyesFreeCalibratorElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
};
const click = (el: Element | null) => (el as HTMLElement).click();
const slide = (el: EyesFreeCalibratorElement, name: string, value: number) => {
  const input = el.querySelector<HTMLInputElement>(`input[data-input="${name}"]`)!;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<eyesfree-calibrator>', () => {
  it('step 1 offers text sizes rendered at their real size', () => {
    const el = mount();
    const radios = el.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(5);
    expect(el.querySelector<HTMLElement>('[data-preview-size="1.5"]')!.style.fontSize).toMatch(/^calc\(1\.725rem\)$|^calc\(1\.15rem \* 1\.5\)$/);
  });

  it('step 2 previews large-radius sharpening that follows the blur slider', () => {
    const el = mount();
    click(el.querySelector('[data-action="next"]'));
    expect(el.step).toBe(2);
    const medium = el.querySelector<HTMLElement>('[data-preview-sharpness="medium"]')!;
    expect(medium.style.filter).toMatch(/^url\(#efc\d+-sharp-medium\)$/);
    const filterId = medium.style.filter.slice(5, -1);
    const blur = () => document.querySelector(`filter#${filterId} feGaussianBlur`)!.getAttribute('stdDeviation');
    expect(blur()).toBe('3');
    // backdrop flood keeps the blur from pulling transparent pixels into the edges
    expect(document.querySelector(`filter#${filterId} feFlood`)).not.toBeNull();
    slide(el, 'radius', 7); // BLUR_RADIUS_STEPS[7] = 6
    expect(el.profile.blurRadius).toBe(6);
    expect(blur()).toBe('6');
    // "No sharpening" has no filter
    expect(el.querySelector<HTMLElement>('[data-preview-sharpness="none"]')!.style.filter).toBe('');
  });

  it('walks all three steps and emits the chosen profile', () => {
    const el = mount();
    const change = vi.fn();
    const complete = vi.fn();
    el.addEventListener(CALIBRATOR_EVENTS.change, change);
    el.addEventListener(CALIBRATOR_EVENTS.complete, complete);

    click(el.querySelector('[data-size="1.75"]'));
    expect(el.querySelector('[data-size="1.75"]')!.getAttribute('aria-checked')).toBe('true');
    click(el.querySelector('[data-action="next"]'));

    slide(el, 'radius', 5);
    click(el.querySelector('[data-sharpness="strong"]'));
    click(el.querySelector('[data-action="next"]'));
    expect(el.step).toBe(3);

    click(el.querySelector('[data-ghost="vertical"]'));
    slide(el, 'crowding', 3);
    expect(el.querySelector('[data-spacing-label]')!.textContent).toBe('Wide');
    click(el.querySelector('[data-action="apply"]'));

    expect(change).toHaveBeenCalled();
    expect(complete.mock.calls[0]![0].detail.profile).toMatchObject({
      fontScale: 1.75,
      blurRadius: 4,
      sharpness: 'strong',
      ghostAxis: 'vertical',
      crowding: 3,
      enabled: true,
    });
  });

  it('back navigates to the previous step', () => {
    const el = mount();
    click(el.querySelector('[data-action="next"]'));
    click(el.querySelector('[data-action="next"]'));
    click(el.querySelector('[data-action="back"]'));
    expect(el.step).toBe(2);
  });

  it('applies the result through an engine', async () => {
    const engine = new EyesFree({ storage: memoryAdapter(), sync: false });
    await engine.init();
    const el = mount();
    el.engine = engine;
    click(el.querySelector('[data-action="next"]'));
    click(el.querySelector('[data-sharpness="mild"]'));
    click(el.querySelector('[data-action="next"]'));
    click(el.querySelector('[data-action="apply"]'));
    expect(engine.getProfile()?.sharpness).toBe('mild');
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
    el.start({ fontScale: 1 });
    const first = el.querySelector<HTMLElement>('[data-size="1"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(el.profile.fontScale).toBe(1.25);
    expect(el.querySelector<HTMLElement>('[data-size="1.25"]')!.tabIndex).toBe(0);
  });

  it('localises and escapes custom text', () => {
    const el = mount({ locale: 'pt-BR', 'sample-text': '<b>X</b>' });
    expect(el.textContent).toContain('Passo 1 de 3');
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
    click(handle.element.querySelector('[data-action="next"]'));
    click(handle.element.querySelector('[data-action="next"]'));
    click(handle.element.querySelector('[data-action="apply"]'));
    const profile = await handle.result;
    expect(profile?.sharpness).toBe('medium');
    expect(document.querySelector('dialog.efc-dialog')).toBeNull();
  });
});
