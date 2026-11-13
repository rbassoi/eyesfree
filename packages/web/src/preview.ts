import { createRenderPlan } from '@eyesfree/core';
import type { RenderPlan, VisionProfile } from '@eyesfree/core';
import { upsertFilter } from './svg.js';
import type { FilterColorSpace } from './svg.js';

/**
 * Renders a profile onto ONE element with inline styles — used for previews (calibration
 * cards, settings screens, "before / after" toggles) without touching the global engine.
 *
 * Each call site needs its own `filterId`.
 *
 * For large-radius plans (`plan.unsharp`), pass `backdrop` (the element's opaque background
 * colour) and wrap the element in a parent with `overflow: hidden`: the filter region is
 * padded so the blur never samples transparent pixels at the element's edges.
 */
export function applyPreview(
  el: HTMLElement,
  profile: Partial<VisionProfile> | RenderPlan,
  options: {
    filterId: string;
    doc?: Document;
    colorSpace?: FilterColorSpace;
    includeFilter?: boolean;
    backdrop?: string;
  },
): RenderPlan {
  const plan: RenderPlan = 'kernels' in profile && 'textShadowCss' in profile ? profile : createRenderPlan(profile);
  const doc = options.doc ?? el.ownerDocument;
  const large = !!plan.unsharp;
  const filter =
    options.includeFilter === false
      ? 'none'
      : upsertFilter(options.filterId, plan, {
          doc,
          region: large ? 'padded' : 'element',
          ...(large && options.backdrop ? { backdrop: options.backdrop } : {}),
          ...(options.colorSpace ? { colorSpace: options.colorSpace } : {}),
        });
  el.style.filter = filter === 'none' ? '' : filter;
  el.style.textShadow = plan.textShadowCss === 'none' ? '' : plan.textShadowCss;
  el.style.letterSpacing = plan.active ? `${plan.letterSpacingEm}em` : '';
  el.style.wordSpacing = plan.active ? `${plan.wordSpacingEm}em` : '';
  el.style.setProperty('-webkit-text-stroke', plan.textStrokePx ? `${plan.textStrokePx}px currentColor` : '');
  return plan;
}

/** Removes inline styles set by {@link applyPreview}. */
export function clearPreview(el: HTMLElement): void {
  el.style.filter = '';
  el.style.textShadow = '';
  el.style.letterSpacing = '';
  el.style.wordSpacing = '';
  el.style.removeProperty('-webkit-text-stroke');
}

/**
 * Developer tool: blurs an element to approximate how an uncorrected eye sees it, so you
 * can evaluate the compensation yourself.
 *
 * Rough guide for `blurPx` (Gaussian σ in CSS px) at 30–40 cm: ≈ 1.2 × dioptres
 * (+1.00 → ~1.2 px, +2.00 → ~2.5 px, +3.00 → ~3.5 px). Default 2.5.
 *
 * Apply it to an element that WRAPS the EyesFree root (filters on the same element
 * would replace each other).
 *
 * @returns a function that removes the simulation
 */
export function simulateDefocus(el: HTMLElement, options: { blurPx?: number; contrast?: number } = {}): () => void {
  const previous = el.style.filter;
  const blur = options.blurPx ?? 2.5;
  const contrast = options.contrast ?? 0.92;
  el.style.filter = `blur(${blur}px) contrast(${contrast})`;
  el.setAttribute('data-eyesfree-simulation', 'defocus');
  return () => {
    el.style.filter = previous;
    el.removeAttribute('data-eyesfree-simulation');
  };
}
