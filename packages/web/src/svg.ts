import { kernelToString, roundWeight } from '@eyesfree/core';
import type { RenderPlan } from '@eyesfree/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** id of the hidden `<svg>` that hosts every EyesFree filter. */
export const DEFS_ID = 'eyesfree-svg-defs';

/** Colour space used by SVG filters. `sRGB` matches the canvas/worker pipeline exactly. */
export type FilterColorSpace = 'sRGB' | 'linearRGB';

type FilterPlan = Pick<RenderPlan, 'active' | 'tone' | 'kernels'> & Partial<Pick<RenderPlan, 'unsharp'>>;

/** A filter primitive, independent of how it is materialised (DOM or string). */
export interface FilterPrimitive {
  tag: string;
  attrs: Record<string, string>;
  children?: FilterPrimitive[];
}

/** Filter region strategy (see {@link upsertFilter}). */
export type FilterRegion =
  /** SVG default (bbox + 10 %). */
  | 'default'
  /** Exactly the element box — avoids frames around small elements with 3×3 kernels. */
  | 'element'
  /** Generous padding (for large-radius blur); combine with `backdrop` and a clipping parent. */
  | 'padded';

/** True when the plan needs an SVG filter at all. */
export function planNeedsFilter(plan: FilterPlan): boolean {
  return plan.active && (plan.tone !== null || plan.kernels.length > 0 || !!plan.unsharp);
}

/**
 * The primitives of a plan's filter, chained with named results:
 * [backdrop] → tone → 3×3 kernels → large-radius unsharp mask.
 *
 * @param backdrop optional opaque colour painted under the source first, so a large blur does
 *                 not pull transparent pixels into the element's edges.
 */
export function filterPrimitives(plan: FilterPlan, backdrop?: string): FilterPrimitive[] {
  const out: FilterPrimitive[] = [];
  let last = 'SourceGraphic';
  let n = 0;
  const next = () => `ef${n++}`;

  if (backdrop) {
    const bd = next();
    out.push({ tag: 'feFlood', attrs: { 'flood-color': backdrop, result: bd } });
    const merged = next();
    out.push({
      tag: 'feMerge',
      attrs: { result: merged },
      children: [
        { tag: 'feMergeNode', attrs: { in: bd } },
        { tag: 'feMergeNode', attrs: { in: 'SourceGraphic' } },
      ],
    });
    last = merged;
  }
  if (plan.tone) {
    const r = next();
    const s = String(roundWeight(plan.tone.slope));
    const i = String(roundWeight(plan.tone.intercept));
    out.push({
      tag: 'feComponentTransfer',
      attrs: { in: last, result: r },
      children: ['feFuncR', 'feFuncG', 'feFuncB'].map((tag) => ({ tag, attrs: { type: 'linear', slope: s, intercept: i } })),
    });
    last = r;
  }
  for (const kernel of plan.kernels) {
    const r = next();
    out.push({
      tag: 'feConvolveMatrix',
      attrs: {
        in: last,
        order: '3 3',
        kernelMatrix: kernelToString(kernel),
        divisor: '1',
        edgeMode: 'duplicate',
        preserveAlpha: 'true',
        result: r,
      },
    });
    last = r;
  }
  if (plan.unsharp && plan.unsharp.sigma > 0 && plan.unsharp.amount !== 0) {
    const blur = next();
    const a = plan.unsharp.amount;
    out.push({ tag: 'feGaussianBlur', attrs: { in: last, stdDeviation: String(roundWeight(plan.unsharp.sigma)), result: blur } });
    const r = next();
    out.push({
      tag: 'feComposite',
      attrs: {
        in: last,
        in2: blur,
        operator: 'arithmetic',
        k1: '0',
        k2: String(roundWeight(1 + a)),
        k3: String(roundWeight(-a)),
        k4: '0',
        result: r,
      },
    });
    last = r;
  }
  return out;
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

function materialise(doc: Document, parent: Element, prims: FilterPrimitive[]): void {
  for (const p of prims) {
    const el = doc.createElementNS(SVG_NS, p.tag);
    for (const [k, v] of Object.entries(p.attrs)) el.setAttribute(k, v);
    if (p.children) materialise(doc, el, p.children);
    parent.appendChild(el);
  }
}

const REGIONS: Record<Exclude<FilterRegion, 'default'>, [string, string, string, string]> = {
  element: ['0', '0', '1', '1'],
  padded: ['-0.25', '-1', '1.5', '3'],
};

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
     * element is still rendered. `element` clips the region to the element's own box (avoids
     * a bright frame around small elements with 3×3 kernels). `padded` enlarges it for
     * large-radius blur previews (use with `backdrop` inside a parent with `overflow:hidden`).
     */
    region?: FilterRegion;
    /** Opaque colour painted under the source before filtering. */
    backdrop?: string;
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
  const region = options.region ?? 'default';
  if (region === 'default') {
    for (const a of ['x', 'y', 'width', 'height']) filter.removeAttribute(a);
  } else {
    const [x, y, w, h] = REGIONS[region];
    filter.setAttribute('x', x);
    filter.setAttribute('y', y);
    filter.setAttribute('width', w);
    filter.setAttribute('height', h);
  }
  while (filter.firstChild) filter.removeChild(filter.firstChild);
  materialise(doc, filter, filterPrimitives(plan, options.backdrop));
  return `url(#${id})`;
}

/** Removes a filter created by {@link upsertFilter}. */
export function removeFilter(id: string, doc: Document = document): void {
  const el = doc.getElementById(id);
  if (el && el.tagName.toLowerCase() === 'filter') el.remove();
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function primitivesToString(prims: FilterPrimitive[]): string {
  return prims
    .map((p) => {
      const attrs = Object.entries(p.attrs)
        .map(([k, v]) => ` ${k}="${escAttr(v)}"`)
        .join('');
      return p.children ? `<${p.tag}${attrs}>${primitivesToString(p.children)}</${p.tag}>` : `<${p.tag}${attrs}/>`;
    })
    .join('');
}

/**
 * Static SVG markup for a plan — handy for server-side rendering, static pages, or
 * copy-pasting into an existing `index.html`.
 */
export function filterMarkup(id: string, plan: FilterPlan, colorSpace: FilterColorSpace = 'sRGB'): string {
  if (!planNeedsFilter(plan)) return '';
  return `<svg xmlns="${SVG_NS}" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs><filter id="${id}" color-interpolation-filters="${colorSpace}">${primitivesToString(filterPrimitives(plan))}</filter></defs></svg>`;
}
