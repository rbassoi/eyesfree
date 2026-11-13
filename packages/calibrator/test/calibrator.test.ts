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

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<eyesfree-calibrator>', () => {
  it('renders six ghost options with live previews', () => {
    const el = mount();
    const radios = el.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(6);
    const horiz = el.querySelector<HTMLElement>('[data-preview-ghost="horizontal"]')!;
    expect(horiz.style.textShadow).toContain('-1.3px');
    expect(horiz.style.filter).toMatch(/^url\(#efc\d+-ghost-horizontal\)$/);
    // previews use a fixed sample background instead of tone mapping
    expect(document.querySelector('filter[id$="ghost-horizontal"] feComponentTransfer')).toBeNull();
  });

  it('walks both steps and emits the chosen profile', () => {
    const el = mount();
    const change = vi.fn();
    const complete = vi.fn();
    el.addEventListener(CALIBRATOR_EVENTS.change, change);
    el.addEventListener(CALIBRATOR_EVENTS.complete, complete);

    click(el.querySelector('[data-ghost="vertical"]'));
    expect(el.querySelector('[data-ghost="vertical"]')!.getAttribute('aria-checked')).toBe('true');
    click(el.querySelector('[data-action="next"]'));
    expect(el.step).toBe(2);

    click(el.querySelector('[data-sharpness="strong"]'));
    const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.value = '3';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.querySelector('[data-spacing-label]')!.textContent).toBe('Wide');

    click(el.querySelector('[data-action="apply"]'));
    expect(change).toHaveBeenCalled();
    const profile = complete.mock.calls[0]![0].detail.profile;
    expect(profile).toMatchObject({ ghostAxis: 'vertical', sharpness: 'strong', crowding: 3, enabled: true });
  });

  it('applies the result through an engine', async () => {
    const engine = new EyesFree({ storage: memoryAdapter(), sync: false });
    await engine.init();
    const el = mount();
    el.engine = engine;
    click(el.querySelector('[data-action="next"]'));
    click(el.querySelector('[data-sharpness="mild"]'));
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
    const first = el.querySelector<HTMLElement>('[data-ghost="none"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.profile.ghostAxis).toBe('horizontal');
    expect(el.querySelector<HTMLElement>('[data-ghost="horizontal"]')!.tabIndex).toBe(0);
  });

  it('localises and escapes custom text', () => {
    const el = mount({ locale: 'pt-BR', 'sample-letters': '<b>X</b>' });
    expect(el.textContent).toContain('Passo 1 de 2');
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
    click(handle.element.querySelector('[data-action="apply"]'));
    const profile = await handle.result;
    expect(profile?.sharpness).toBe('medium');
    expect(document.querySelector('dialog.efc-dialog')).toBeNull();
  });
});
