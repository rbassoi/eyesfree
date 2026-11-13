import { createRenderPlan } from '@eyesfree/core';
import type { RenderPlan, VisionProfile } from '@eyesfree/core';
import { upsertFilter } from './svg.js';
import type { FilterColorSpace } from './svg.js';

/**
 * Renders a profile onto ONE element with inline styles — used for previews (calibration
 * cards, settings screens, "before / after" toggles) without touching the global engine.
 *
 * Each call site needs its own `filterId`.
 */
export function applyPreview(
  el: HTMLElement,
  profile: Partial<VisionProfile> | RenderPlan,
  options: { filterId: string; doc?: Document; colorSpace?: FilterColorSpace; includeFilter?: boolean },
): RenderPlan {
  const plan: RenderPlan = 'kernels' in profile && 'textShadowCss' in profile ? profile : createRenderPlan(profile);
  const doc = options.doc ?? el.ownerDocument;
  const filter =
    options.includeFilter === false
      ? 'none'
      : upsertFilter(options.filterId, plan, {
          doc,
          region: 'element',
          ...(options.colorSpace ? { colorSpace: options.colorSpace } : {}),
        });
  el.style.filter = filter === 'none' ? '' : filter;
  el.style.textShadow = plan.textShadowCss === 'none' ? '' : plan.textShadowCss;
  el.style.letterSpacing = plan.active ? `${plan.letterSpacingEm}em` : '';
  el.style.wordSpacing = plan.active ? `${plan.wordSpacingEm}em` : '';
  return plan;
}

/** Removes inline styles set by {@link applyPreview}. */
export function clearPreview(el: HTMLElement): void {
  el.style.filter = '';
  el.style.textShadow = '';
  el.style.letterSpacing = '';
  el.style.wordSpacing = '';
}

/**
 * Developer tool: blurs an element to approximate how an uncorrected eye (≈1.5–2 D of
 * defocus at reading distance) sees it, so you can evaluate the compensation yourself.
 *
 * Apply it to an element that WRAPS the EyesFree root (filters on the same element
 * would replace each other).
 *
 * @returns a function that removes the simulation
 */
export function simulateDefocus(el: HTMLElement, options: { blurPx?: number; contrast?: number } = {}): () => void {
  const previous = el.style.filter;
  const blur = options.blurPx ?? 1.45;
  const contrast = options.contrast ?? 0.92;
  el.style.filter = `blur(${blur}px) contrast(${contrast})`;
  el.setAttribute('data-eyesfree-simulation', 'defocus');
  return () => {
    el.style.filter = previous;
    el.removeAttribute('data-eyesfree-simulation');
  };
}
