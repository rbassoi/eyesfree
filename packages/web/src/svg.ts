import { kernelToString, roundWeight } from '@eyesfree/core';
import type { RenderPlan } from '@eyesfree/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** id of the hidden `<svg>` that hosts every EyesFree filter. */
export const DEFS_ID = 'eyesfree-svg-defs';

/** Colour space used by SVG filters. `sRGB` matches the canvas/worker pipeline exactly. */
export type FilterColorSpace = 'sRGB' | 'linearRGB';

type FilterPlan = Pick<RenderPlan, 'active' | 'tone' | 'kernels'>;

/** True when the plan needs an SVG filter at all. */
export function planNeedsFilter(plan: FilterPlan): boolean {
  return plan.active && (plan.tone !== null || plan.kernels.length > 0);
}

/** Returns (creating if needed) the hidden `<svg><defs>` container. */
export function getDefs(doc: Document = document): SVGDefsElement {
  let svg = doc.getElementById(DEFS_ID) as SVGSVGElement | null;
  if (!svg) {
    svg = doc.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('id', DEFS_ID);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
    svg.appendChild(doc.createElementNS(SVG_NS, 'defs'));
    (doc.body ?? doc.documentElement).appendChild(svg);
  }
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = doc.createElementNS(SVG_NS, 'defs') as SVGDefsElement;
    svg.appendChild(defs);
  }
  return defs as SVGDefsElement;
}

function buildPrimitives(doc: Document, filter: Element, plan: FilterPlan): void {
  if (plan.tone) {
    const ct = doc.createElementNS(SVG_NS, 'feComponentTransfer');
    for (const ch of ['feFuncR', 'feFuncG', 'feFuncB']) {
      const fn = doc.createElementNS(SVG_NS, ch);
      fn.setAttribute('type', 'linear');
      fn.setAttribute('slope', String(roundWeight(plan.tone.slope)));
      fn.setAttribute('intercept', String(roundWeight(plan.tone.intercept)));
      ct.appendChild(fn);
    }
    filter.appendChild(ct);
  }
  for (const kernel of plan.kernels) {
    const cm = doc.createElementNS(SVG_NS, 'feConvolveMatrix');
    cm.setAttribute('order', '3 3');
    cm.setAttribute('kernelMatrix', kernelToString(kernel));
    cm.setAttribute('divisor', '1');
    cm.setAttribute('edgeMode', 'duplicate');
    cm.setAttribute('preserveAlpha', 'true');
    filter.appendChild(cm);
  }
}

/**
 * Creates or replaces `<filter id>` for a plan.
 *
 * @returns the CSS value to reference it (`url(#id)`), or `'none'` when the plan needs no
 *          filter (in which case any previous filter with that id is removed).
 */
export function upsertFilter(
  id: string,
  plan: FilterPlan,
  options: {
    doc?: Document;
    colorSpace?: FilterColorSpace;
    /**
     * `default` keeps the SVG default filter region (bbox + 10%), so content overflowing the
     * element is still rendered. `element` clips the region to the element's own box: with
     * `edgeMode="duplicate"` this avoids a bright frame around small opaque elements
     * (previews, badges, cards).
     */
    region?: 'default' | 'element';
  } = {},
): string {
  const doc = options.doc ?? document;
  if (!planNeedsFilter(plan)) {
    removeFilter(id, doc);
    return 'none';
  }
  const defs = getDefs(doc);
  let filter: Element | null = doc.getElementById(id);
  if (!filter || filter.parentNode !== defs) {
    filter?.remove();
    filter = doc.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', id);
    defs.appendChild(filter);
  }
  filter.setAttribute('color-interpolation-filters', options.colorSpace ?? 'sRGB');
  if (options.region === 'element') {
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '1');
    filter.setAttribute('height', '1');
  } else {
    for (const a of ['x', 'y', 'width', 'height']) filter.removeAttribute(a);
  }
  while (filter.firstChild) filter.removeChild(filter.firstChild);
  buildPrimitives(doc, filter, plan);
  return `url(#${id})`;
}

/** Removes a filter created by {@link upsertFilter}. */
export function removeFilter(id: string, doc: Document = document): void {
  const el = doc.getElementById(id);
  if (el && el.tagName.toLowerCase() === 'filter') el.remove();
}

/**
 * Static SVG markup for a plan — handy for server-side rendering, e-mail-free static
 * pages, or copy-pasting into an existing `index.html`.
 */
export function filterMarkup(id: string, plan: FilterPlan, colorSpace: FilterColorSpace = 'sRGB'): string {
  if (!planNeedsFilter(plan)) return '';
  const parts: string[] = [];
  if (plan.tone) {
    const s = roundWeight(plan.tone.slope);
    const i = roundWeight(plan.tone.intercept);
    parts.push(
      `<feComponentTransfer>${['R', 'G', 'B']
        .map((c) => `<feFunc${c} type="linear" slope="${s}" intercept="${i}"/>`)
        .join('')}</feComponentTransfer>`,
    );
  }
  for (const k of plan.kernels) {
    parts.push(
      `<feConvolveMatrix order="3 3" kernelMatrix="${kernelToString(k)}" divisor="1" edgeMode="duplicate" preserveAlpha="true"/>`,
    );
  }
  return `<svg xmlns="${SVG_NS}" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs><filter id="${id}" color-interpolation-filters="${colorSpace}">${parts.join('')}</filter></defs></svg>`;
}
