import type { RenderPlan } from '@eyesfree/core';

/** CSS classes toggled on the root element. */
export const CLASSES = Object.freeze({
  active: 'eyesfree-active',
  scopeRoot: 'eyesfree-scope-root',
  scopeOptIn: 'eyesfree-scope-opt-in',
  palette: 'eyesfree-palette',
  zoom: 'eyesfree-zoom',
});

/** Data attributes understood by the stylesheet. */
export const ATTRIBUTES = Object.freeze({
  /** Opt an element (and its subtree) out of spacing / text-shadow changes. */
  ignore: 'data-eyesfree-ignore',
  /** In `opt-in` scope, only elements with this attribute receive the optical filter. */
  text: 'data-eyesfree-text',
  /** In `palette` surface mode, elements with this attribute receive the surface colour. */
  surface: 'data-eyesfree-surface',
});

/** Names of the CSS custom properties set on the root element. */
export const CSS_VARS = Object.freeze({
  filter: '--eyesfree-filter',
  textShadow: '--eyesfree-text-shadow',
  letterSpacing: '--eyesfree-letter-spacing',
  wordSpacing: '--eyesfree-word-spacing',
  fontScale: '--eyesfree-font-scale',
  fontWeightDelta: '--eyesfree-font-weight-delta',
  textStroke: '--eyesfree-text-stroke',
  bg: '--eyesfree-bg',
  surfaceBg: '--eyesfree-surface-bg',
  border: '--eyesfree-border',
  fg: '--eyesfree-fg',
});

export const STYLE_ELEMENT_ID = 'eyesfree-styles';

/**
 * The stylesheet. Kept as plain CSS so it can also be shipped as `eyesfree.css` for
 * strict-CSP sites that forbid inline `<style>` injection.
 */
export const EYESFREE_CSS = `
.${CLASSES.active},
.${CLASSES.active} :not([${ATTRIBUTES.ignore}], [${ATTRIBUTES.ignore}] *) {
  letter-spacing: var(${CSS_VARS.letterSpacing}, normal) !important;
  word-spacing: var(${CSS_VARS.wordSpacing}, normal) !important;
  text-shadow: var(${CSS_VARS.textShadow}, none) !important;
  -webkit-text-stroke: var(${CSS_VARS.textStroke}, 0px) currentColor;
}
/* Magnification: applied to the root's children so the root's SVG filter keeps working in
   real screen pixels (the user's blur size does not change when text gets bigger). */
.${CLASSES.active}.${CLASSES.zoom} > :not([${ATTRIBUTES.ignore}], svg, script, style, dialog) {
  zoom: var(${CSS_VARS.fontScale}, 1);
}
.${CLASSES.active}.${CLASSES.scopeRoot} {
  filter: var(${CSS_VARS.filter}, none);
}
.${CLASSES.active}.${CLASSES.scopeOptIn} [${ATTRIBUTES.text}] {
  filter: var(${CSS_VARS.filter}, none);
}
.${CLASSES.active}.${CLASSES.palette} {
  background-color: var(${CSS_VARS.bg}) !important;
  color: var(${CSS_VARS.fg}) !important;
}
.${CLASSES.active}.${CLASSES.palette} [${ATTRIBUTES.surface}] {
  background-color: var(${CSS_VARS.surfaceBg}) !important;
  border-color: var(${CSS_VARS.border}) !important;
}
@media (prefers-reduced-motion: no-preference) {
  .${CLASSES.active} { transition: filter 160ms ease-out; }
}
`.trim();

/** Injects the stylesheet once per document. */
export function ensureStyles(doc: Document = document, nonce?: string): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  if (nonce) style.setAttribute('nonce', nonce);
  style.textContent = EYESFREE_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

/** CSS custom properties for a plan. */
export function cssVariables(plan: RenderPlan, filterValue = 'none'): Record<string, string> {
  const vars: Record<string, string> = {
    [CSS_VARS.filter]: plan.active ? filterValue : 'none',
    [CSS_VARS.textShadow]: plan.textShadowCss,
    [CSS_VARS.letterSpacing]: `${plan.letterSpacingEm}em`,
    [CSS_VARS.wordSpacing]: `${plan.wordSpacingEm}em`,
    [CSS_VARS.fontScale]: String(plan.fontScale),
    [CSS_VARS.fontWeightDelta]: String(plan.fontWeightDelta),
    [CSS_VARS.textStroke]: `${plan.textStrokePx}px`,
  };
  if (plan.surface) {
    vars[CSS_VARS.bg] = plan.surface.background;
    vars[CSS_VARS.surfaceBg] = plan.surface.surface;
    vars[CSS_VARS.border] = plan.surface.border;
    vars[CSS_VARS.fg] = plan.surface.text;
  }
  return vars;
}

/** Sets a map of CSS variables on an element. */
export function setVariables(el: HTMLElement, vars: Record<string, string>): void {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}

/** Removes every EyesFree CSS variable from an element. */
export function clearVariables(el: HTMLElement): void {
  for (const name of Object.values(CSS_VARS)) el.style.removeProperty(name);
}
