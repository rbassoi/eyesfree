import {
  nearestDistance,
  BLUR_RADIUS_STEPS,
  createRenderPlan,
  DEFAULT_PROFILE,
  DISTANCE_OPTIONS_CM,
  FONT_SCALE_RANGE,
  normalizeProfile,
  REFERENCE_READING_DISTANCE_CM,
  suggestFontScale,
} from '@eyesfree/core';
import type { CrowdingLevel, GhostAxis, RenderPlan, SharpnessLevel, VisionProfile } from '@eyesfree/core';
import { applyPreview, removeFilter } from '@eyesfree/web';
import type { EyesFree } from '@eyesfree/web';
import { formatStep, mergeMessages, resolveLocale } from './i18n.js';
import type { CalibratorMessages } from './i18n.js';
import { ensureCalibratorStyles } from './styles.js';

/** Order of the ghost (doubled letters) cards — matches the original prototype. */
export const GHOST_OPTIONS: readonly GhostAxis[] = ['none', 'horizontal', 'vertical', 'diagonal135', 'diagonal45', 'outline'];
/** Order of the sharpness options. */
export const SHARPNESS_OPTIONS: readonly SharpnessLevel[] = ['none', 'mild', 'medium', 'strong'];
/** Distances offered in step 1 (cm). The first one is the normal reading distance. */
export const DISTANCE_CHOICES: readonly number[] = [REFERENCE_READING_DISTANCE_CM, ...DISTANCE_OPTIONS_CM];

/**
 * 1 = viewing distance · 2 = text size · 3 = sharpness + blur size (optional) ·
 * 4 = doubled letters + spacing (optional).
 */
export type CalibratorStep = 1 | 2 | 3 | 4;
export const CALIBRATOR_STEPS = 4;

export interface CalibratorChangeDetail {
  profile: VisionProfile;
  step: CalibratorStep;
}
export interface CalibratorCompleteDetail {
  profile: VisionProfile;
}

/** Events emitted by `<eyesfree-calibrator>` (they bubble and cross shadow roots). */
export const CALIBRATOR_EVENTS = Object.freeze({
  change: 'eyesfree-change',
  step: 'eyesfree-step',
  complete: 'eyesfree-complete',
  cancel: 'eyesfree-cancel',
});

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Index of the slider stop closest to `radius`. */
const radiusIndex = (radius: number) =>
  BLUR_RADIUS_STEPS.reduce((best, r, i) => (Math.abs(r - radius) < Math.abs(BLUR_RADIUS_STEPS[best]! - radius) ? i : best), 0);

/** Candidate sizes around a suggestion (±1 in 0.5 steps, clamped to 1–4). */
export function sizeOptionsAround(suggestion: number): number[] {
  const out = new Set<number>();
  for (const k of [-1, -0.5, 0, 0.5, 1]) {
    const v = Math.min(FONT_SCALE_RANGE.max, Math.max(FONT_SCALE_RANGE.min, suggestion + k));
    out.add(Math.round(v * 4) / 4);
  }
  return [...out].sort((a, b) => a - b);
}

/** "50 cm", "1 m", "1.3 m" (+ feet for English). */
function formatDistance(cm: number, locale: string): string {
  let nf: Intl.NumberFormat;
  try {
    nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  } catch {
    nf = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
  }
  const metric = cm < 100 ? `${nf.format(cm)} cm` : `${nf.format(cm / 100)} m`;
  return locale.toLowerCase().startsWith('en') ? `${metric} (${nf.format(Math.round(cm / 30.48 * 2) / 2)} ft)` : metric;
}

const DEFAULT_SAMPLE_BG = '#e4e7ec';

/**
 * Minimal shape of a camera distance monitor (`DistanceMonitor` from `@eyesfree/distance`
 * satisfies it). Kept structural so the calibrator never depends on the camera package.
 */
export interface DistanceMonitorLike {
  readonly running: boolean;
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: (reading: { status: string; cm: number | null }) => void): () => void;
}

let uidCounter = 0;

// SSR-safe base class.
const BaseElement: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

/**
 * `<eyesfree-calibrator>` — the perceptual calibration wizard:
 * 1. move back until text is sharp → `viewingDistance` (+ suggested `fontScale`)
 * 2. smallest comfortable size from there → `fontScale`
 * 3. (optional) blur size + sharpening → `blurRadius`, `sharpness`
 * 4. (optional) least-doubled letters + spacing → `ghostAxis`, `crowding`
 *
 * From step 2 on, the wizard magnifies itself so it can be read from the chosen distance.
 *
 * Attributes: `locale`, `sample-letters`, `sample-text`, `nonce`, `hide-cancel`.
 * Properties: `engine`, `autoApply`, `suspendEngine`, `messages`, `profile`, `step`.
 * Events: `eyesfree-change`, `eyesfree-step`, `eyesfree-complete`, `eyesfree-cancel`.
 */
export class EyesFreeCalibratorElement extends BaseElement {
  static get observedAttributes(): string[] {
    return ['locale', 'sample-letters', 'sample-text', 'hide-cancel'];
  }

  /** Optional engine. When set and `autoApply` is true, "Apply" calls `engine.apply()`. */
  engine: EyesFree | null = null;
  /** Apply the result through `engine` on completion. Default `true`. */
  autoApply = true;
  /**
   * While a session started with `start()` is open, suspend the engine so the previews are
   * not compensated twice (when the calibrator lives inside the compensated root).
   * Default `true`.
   */
  suspendEngine = true;
  private releaseEngine: (() => void) | null = null;

  /**
   * Optional camera distance monitor. When set, step 1 offers "Measure with the camera",
   * which selects the distance automatically.
   */
  distanceMonitor: DistanceMonitorLike | null = null;
  private unsubscribeMonitor: (() => void) | null = null;
  private startedMonitor = false;
  private cameraState: 'off' | 'measuring' | 'error' = 'off';

  private _messages: Partial<CalibratorMessages> | null = null;
  private _draft: VisionProfile | null = null;
  private _step: CalibratorStep = 1;
  private readonly uid = `efc${++uidCounter}`;
  private filterIds = new Set<string>();

  // ------------------------------------------------------------------ public API

  /** Message overrides (merged over the active locale). */
  get messages(): Partial<CalibratorMessages> | null {
    return this._messages;
  }
  set messages(value: Partial<CalibratorMessages> | null) {
    this._messages = value;
    this.renderIfConnected();
  }

  /** Current draft profile (what the user has selected so far). */
  get profile(): VisionProfile {
    if (!this._draft) this._draft = this.initialDraft();
    return this._draft;
  }
  set profile(value: Partial<VisionProfile> | null) {
    this._draft = value ? normalizeProfile({ ...value, enabled: true }) : null;
    this.renderIfConnected();
  }

  /** Current step. */
  get step(): CalibratorStep {
    return this._step;
  }
  set step(value: CalibratorStep) {
    this.goTo(value);
  }

  /**
   * Magnification of the wizard's own UI: 1 in step 1 (read up close, with glasses), then
   * the size suggested by the chosen distance, so the instructions stay readable.
   */
  get uiScale(): number {
    return this._step === 1 ? 1 : suggestFontScale(this.profile.viewingDistance);
  }

  /** Restarts the wizard at step 1 from `profile`, or from the engine's current profile / defaults. */
  start(profile?: Partial<VisionProfile>): void {
    this._draft = profile ? normalizeProfile({ ...profile, enabled: true }) : this.initialDraft();
    this._step = 1;
    if (this.engine && this.suspendEngine && !this.releaseEngine) this.releaseEngine = this.engine.suspend();
    this.renderIfConnected(true);
  }

  /** Navigates to a step. */
  goTo(step: CalibratorStep): void {
    this._step = Math.min(CALIBRATOR_STEPS, Math.max(1, Math.round(step))) as CalibratorStep;
    if (this._step !== 1) this.stopCamera();
    this.renderIfConnected(true);
    this.fire<{ step: CalibratorStep }>(CALIBRATOR_EVENTS.step, { step: this._step });
  }

  /** Finishes the wizard: emits `eyesfree-complete` and (optionally) applies via `engine`. */
  complete(): VisionProfile {
    const profile: VisionProfile = { ...this.profile, enabled: true, updatedAt: new Date().toISOString() };
    this.release();
    if (this.engine && this.autoApply) this.engine.apply(profile);
    this.fire<CalibratorCompleteDetail>(CALIBRATOR_EVENTS.complete, { profile });
    return profile;
  }

  /** Emits `eyesfree-cancel` (and resumes a suspended engine). */
  cancel(): void {
    this.release();
    this.fire(CALIBRATOR_EVENTS.cancel, {});
  }

  // ------------------------------------------------------------- lifecycle

  connectedCallback(): void {
    ensureCalibratorStyles(this.ownerDocument, this.getAttribute('nonce') ?? undefined);
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('input', this.onInput);
    this.render();
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('keydown', this.onKeyDown);
    this.removeEventListener('input', this.onInput);
    this.release();
    for (const id of this.filterIds) removeFilter(id, this.ownerDocument);
    this.filterIds.clear();
  }

  attributeChangedCallback(): void {
    this.renderIfConnected();
  }

  // ------------------------------------------------------------- internals

  private release(): void {
    this.releaseEngine?.();
    this.releaseEngine = null;
    this.stopCamera();
  }

  private async startCamera(): Promise<void> {
    const monitor = this.distanceMonitor;
    if (!monitor || this.unsubscribeMonitor) return;
    this.cameraState = 'measuring';
    this.unsubscribeMonitor = monitor.subscribe((r) => this.onReading(r));
    this.renderIfConnected();
    try {
      if (!monitor.running) {
        this.startedMonitor = true;
        await monitor.start();
      }
    } catch {
      this.stopCamera();
      this.cameraState = 'error';
      this.renderIfConnected();
    }
  }

  private stopCamera(): void {
    this.unsubscribeMonitor?.();
    this.unsubscribeMonitor = null;
    if (this.startedMonitor) this.distanceMonitor?.stop();
    this.startedMonitor = false;
    if (this.cameraState === 'measuring') this.cameraState = 'off';
  }

  private onReading(r: { status: string; cm: number | null }): void {
    const out = this.querySelector('[data-measured]');
    if (!out) return;
    if (r.cm !== null && r.status === 'measuring') {
      out.textContent = this.msgs.measuredDistance.replace('{distance}', formatDistance(r.cm, this.locale));
      const nearest = nearestDistance(r.cm, DISTANCE_CHOICES);
      const current = this.profile.viewingDistance || REFERENCE_READING_DISTANCE_CM;
      if (this._step === 1 && nearest !== current) this.selectDistance(nearest);
    } else {
      out.textContent = this.msgs.measuring;
    }
  }

  private get locale(): string {
    return this.getAttribute('locale') ?? this.ownerDocument?.documentElement?.lang ?? 'en';
  }

  private get msgs(): CalibratorMessages {
    return mergeMessages(resolveLocale(this.locale), this._messages);
  }

  private initialDraft(): VisionProfile {
    const fromEngine = this.engine?.getProfile();
    return normalizeProfile({ ...DEFAULT_PROFILE, ...(fromEngine ?? {}), enabled: true });
  }

  private renderIfConnected(focus = false): void {
    if (this.isConnected) {
      this.render();
      if (focus) this.querySelector<HTMLElement>('.efc-instruction')?.focus();
    }
  }

  private fire<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }

  /** A selectable card whose sample sits in a clipping box (needed by large-radius previews). */
  private card(attrs: string, checked: boolean, head: string, previewAttr: string, sample: string, sampleClass: string): string {
    return `
      <button type="button" class="efc-card" part="card" role="radio" aria-checked="${checked}"
        tabindex="${checked ? 0 : -1}" ${attrs}>
        ${head}
        ${sample ? `<span class="efc-clip"><span class="efc-sample ${sampleClass}" ${previewAttr} aria-hidden="true">${sample}</span></span>` : ''}
      </button>`;
  }

  private render(): void {
    const m = this.msgs;
    const p = this.profile;
    const letters = esc(this.getAttribute('sample-letters') ?? m.sampleLetters);
    const sentence = esc(this.getAttribute('sample-text') ?? m.sampleText);
    const hideCancel = this.hasAttribute('hide-cancel');
    const instruction = [m.distanceInstruction, m.sizeInstruction, m.sharpnessInstruction, m.ghostInstruction][this._step - 1]!;

    const head = `
      <div class="efc-panel" part="panel">
        <div class="efc-head">
          <p class="efc-title">${esc(m.title)}</p>
          <span class="efc-step" aria-live="polite">${esc(formatStep(m.stepIndicator, this._step, CALIBRATOR_STEPS))}</span>
        </div>
        <p class="efc-instruction" tabindex="-1">${esc(instruction)}</p>
      </div>`;

    const btn = (action: string, cls: string, label: string) =>
      `<button type="button" class="efc-btn ${cls}" data-action="${action}">${label}</button>`;
    const back = btn('back', 'efc-btn-secondary', `← ${esc(m.back)}`);
    const cancel = hideCancel ? '' : btn('cancel', 'efc-btn-secondary', esc(m.cancel));
    const next = btn('next', 'efc-btn-primary', `${esc(m.next)} →`);
    const more = btn('next', 'efc-btn-secondary', `${esc(m.moreAdjustments)} →`);
    const apply = btn('apply', 'efc-btn-confirm', `${esc(m.apply)} ✓`);

    let body: string;
    if (this._step === 1) {
      const camera = !this.distanceMonitor
        ? ''
        : this.cameraState === 'measuring'
          ? `<div class="efc-camera">
               <p class="efc-measured" data-measured aria-live="polite">${esc(m.measuring)}</p>
               ${btn('camera-stop', 'efc-btn-secondary', `📷 ${esc(m.stopCamera)}`)}
             </div>`
          : `<div class="efc-camera">
               ${this.cameraState === 'error' ? `<p class="efc-hint">${esc(m.cameraError)}</p>` : ''}
               ${btn('camera', 'efc-btn-primary', `📷 ${esc(m.measureWithCamera)}`)}
               <p class="efc-hint">${esc(m.cameraPrivacy)}</p>
             </div>`;
      body = `
      ${camera}
      <div class="efc-distance-sample" aria-hidden="true">
        <span class="efc-distance-letters">${letters}</span>
        <span class="efc-distance-text">${esc(m.distanceSampleText)}</span>
      </div>
      <div class="efc-list efc-list-compact" role="radiogroup" aria-label="${esc(m.distanceGroupLabel)}" data-group="distance">
        ${DISTANCE_CHOICES.map((cm) => {
          const label =
            cm === REFERENCE_READING_DISTANCE_CM
              ? `${m.distanceNormal} (${formatDistance(cm, this.locale)})`
              : m.distanceOption.replace('{distance}', formatDistance(cm, this.locale));
          const checked = (p.viewingDistance || REFERENCE_READING_DISTANCE_CM) === cm;
          return this.card(`data-distance="${cm}"`, checked, `<span class="efc-card-label efc-card-label-lg">${esc(label)}</span>`, '', '', '');
        }).join('')}
      </div>
      <div class="efc-actions">${cancel}${next}</div>`;
    } else if (this._step === 2) {
      body = `
      <div class="efc-list" role="radiogroup" aria-label="${esc(m.sizeGroupLabel)}" data-group="size">
        ${sizeOptionsAround(suggestFontScale(p.viewingDistance)).map((scale) =>
          this.card(
            `data-size="${scale}"`,
            p.fontScale === scale,
            `<span class="efc-card-label">${esc(m.sizeOption.replace('{percent}', String(Math.round(scale * 100))))}</span>`,
            `data-preview-size="${scale}"`,
            esc(m.sizeSample),
            'efc-sample-text',
          ),
        ).join('')}
      </div>
      <div class="efc-actions">${back}${more}${apply}</div>`;
    } else if (this._step === 3) {
      const ri = radiusIndex(p.blurRadius);
      body = `
      <label class="efc-slider">
        <span class="efc-slider-label">${esc(m.radiusLabel)}: <output data-radius-label>${ri + 1} / ${BLUR_RADIUS_STEPS.length}</output></span>
        <input type="range" min="0" max="${BLUR_RADIUS_STEPS.length - 1}" step="1" value="${ri}" data-input="radius"
          aria-valuetext="${ri + 1} / ${BLUR_RADIUS_STEPS.length}" />
        <span class="efc-hint">${esc(m.radiusHint)}</span>
      </label>
      <div class="efc-list" role="radiogroup" aria-label="${esc(m.sharpnessGroupLabel)}" data-group="sharpness">
        ${SHARPNESS_OPTIONS.map((level) => {
          const info = m.sharpness[level];
          return this.card(
            `data-sharpness="${level}"`,
            p.sharpness === level,
            `<span class="efc-card-row"><span class="efc-card-label">${esc(info.label)}</span></span>
             <span class="efc-hint">${esc(info.hint)}</span>`,
            `data-preview-sharpness="${level}"`,
            sentence,
            'efc-sample-text',
          );
        }).join('')}
      </div>
      <div class="efc-actions">${back}${next}${apply}</div>`;
    } else {
      body = `
      <div class="efc-grid" role="radiogroup" aria-label="${esc(m.ghostGroupLabel)}" data-group="ghost">
        ${GHOST_OPTIONS.map((axis) =>
          this.card(
            `data-ghost="${axis}"`,
            p.ghostAxis === axis,
            `<span class="efc-card-label">${esc(m.ghost[axis])}</span>`,
            `data-preview-ghost="${axis}"`,
            `<span class="efc-sample-letters">${letters}</span><span class="efc-sample-word">${esc(m.sampleWord)}</span>`,
            'efc-sample-stack',
          ),
        ).join('')}
      </div>
      <label class="efc-slider">
        <span class="efc-slider-label">${esc(m.spacingLabel)}: <output data-spacing-label>${esc(m.spacingLevels[p.crowding])}</output></span>
        <input type="range" min="0" max="3" step="1" value="${p.crowding}" data-input="crowding"
          aria-valuetext="${esc(m.spacingLevels[p.crowding])}" />
      </label>
      <div class="efc-actions">${back}${apply}</div>`;
    }

    const ui = this.uiScale;
    this.innerHTML = `<div class="efc" part="container"${ui !== 1 ? ` style="zoom:${ui}"` : ''}>${head}${body}</div>`;
    this.updatePreviews();
  }

  /** Re-applies the inline previews for the current step (at their true on-screen size). */
  private updatePreviews(): void {
    const p = this.profile;
    const ui = this.uiScale;
    // Inside the zoomed wizard, `rem` values are multiplied by `ui`: divide to get true sizes.
    const trueSize = (scale: number) => `calc(1rem * ${Math.round((scale / ui) * 1000) / 1000})`;
    const base: Partial<VisionProfile> = {
      surfaceCompensation: p.surfaceCompensation,
      intensity: p.intensity,
      enabled: true,
      blurRadius: p.blurRadius,
    };
    if (this._step === 2) {
      this.querySelectorAll<HTMLElement>('[data-preview-size]').forEach((el) => {
        el.style.fontSize = trueSize(Number(el.dataset.previewSize));
      });
    } else if (this._step === 3) {
      for (const level of SHARPNESS_OPTIONS) {
        const plan = this.previewPlan({ ...base, ghostAxis: 'none', sharpness: level, crowding: p.crowding });
        const el = this.querySelector<HTMLElement>(`[data-preview-sharpness="${level}"]`);
        if (el) {
          el.style.fontSize = trueSize(p.fontScale);
          this.preview(el, plan, `sharp-${level}`);
        }
      }
    } else if (this._step === 4) {
      for (const axis of GHOST_OPTIONS) {
        const plan = this.previewPlan({ ...base, ghostAxis: axis, sharpness: p.sharpness, crowding: p.crowding });
        const el = this.querySelector<HTMLElement>(`[data-preview-ghost="${axis}"]`);
        if (el) {
          el.style.fontSize = trueSize(p.fontScale);
          this.preview(el, plan, `ghost-${axis}`);
        }
      }
    }
  }

  private preview(el: HTMLElement, plan: RenderPlan, suffix: string): void {
    let backdrop = DEFAULT_SAMPLE_BG;
    try {
      const bg = this.ownerDocument.defaultView?.getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) backdrop = bg;
    } catch {
      /* ignore */
    }
    applyPreview(el, plan, { filterId: this.filterId(suffix), backdrop });
  }

  /** Previews use a fixed light-grey sample background instead of tone mapping. */
  private previewPlan(profile: Partial<VisionProfile>): RenderPlan {
    return { ...createRenderPlan(profile), tone: null };
  }

  private filterId(suffix: string): string {
    const id = `${this.uid}-${suffix}`;
    this.filterIds.add(id);
    return id;
  }

  private select(patch: Partial<VisionProfile>): void {
    this._draft = normalizeProfile({ ...this.profile, ...patch, enabled: true });
    const d = this._draft;
    // Update radio state without re-rendering (keeps focus and avoids flicker).
    this.querySelectorAll<HTMLElement>('[role="radio"]').forEach((el) => {
      const checked =
        (el.dataset.ghost !== undefined && el.dataset.ghost === d.ghostAxis) ||
        (el.dataset.sharpness !== undefined && el.dataset.sharpness === d.sharpness) ||
        (el.dataset.size !== undefined && Number(el.dataset.size) === d.fontScale) ||
        (el.dataset.distance !== undefined && Number(el.dataset.distance) === (d.viewingDistance || REFERENCE_READING_DISTANCE_CM));
      el.setAttribute('aria-checked', String(checked));
      el.tabIndex = checked ? 0 : -1;
    });
    if (patch.crowding !== undefined || patch.blurRadius !== undefined) this.updatePreviews();
    this.fire<CalibratorChangeDetail>(CALIBRATOR_EVENTS.change, { profile: d, step: this._step });
  }

  /** Choosing a distance also suggests the matching magnification. */
  private selectDistance(cm: number): void {
    const patch: Partial<VisionProfile> = {
      viewingDistance: cm === REFERENCE_READING_DISTANCE_CM ? 0 : cm,
      fontScale: suggestFontScale(cm),
    };
    // At a distance where the eye focuses, sharpening filters are unnecessary.
    if (cm > REFERENCE_READING_DISTANCE_CM) Object.assign(patch, { sharpness: 'none', ghostAxis: 'none' });
    this.select(patch);
  }

  private onClick = (ev: Event): void => {
    const target = (ev.target as Element | null)?.closest<HTMLElement>(
      '[data-ghost],[data-sharpness],[data-size],[data-distance],[data-action]',
    );
    if (!target || !this.contains(target)) return;
    if (target.dataset.ghost) this.select({ ghostAxis: target.dataset.ghost as GhostAxis });
    else if (target.dataset.sharpness) this.select({ sharpness: target.dataset.sharpness as SharpnessLevel });
    else if (target.dataset.size) this.select({ fontScale: Number(target.dataset.size) });
    else if (target.dataset.distance) this.selectDistance(Number(target.dataset.distance));
    else {
      switch (target.dataset.action) {
        case 'next':
          this.goTo((this._step + 1) as CalibratorStep);
          break;
        case 'back':
          this.goTo((this._step - 1) as CalibratorStep);
          break;
        case 'apply':
          this.complete();
          break;
        case 'cancel':
          this.cancel();
          break;
        case 'camera':
          void this.startCamera();
          break;
        case 'camera-stop':
          this.stopCamera();
          this.renderIfConnected();
          break;
      }
    }
  };

  private onInput = (ev: Event): void => {
    const input = ev.target as HTMLInputElement | null;
    if (!input) return;
    if (input.dataset.input === 'crowding') {
      const level = Number(input.value) as CrowdingLevel;
      const label = this.msgs.spacingLevels[level];
      input.setAttribute('aria-valuetext', label);
      const out = this.querySelector('[data-spacing-label]');
      if (out) out.textContent = label;
      this.select({ crowding: level });
    } else if (input.dataset.input === 'radius') {
      const i = Number(input.value);
      const label = `${i + 1} / ${BLUR_RADIUS_STEPS.length}`;
      input.setAttribute('aria-valuetext', label);
      const out = this.querySelector('[data-radius-label]');
      if (out) out.textContent = label;
      this.select({ blurRadius: BLUR_RADIUS_STEPS[i] ?? DEFAULT_PROFILE.blurRadius });
    }
  };

  /** Roving-tabindex arrow-key navigation inside radio groups (WAI-ARIA pattern). */
  private onKeyDown = (ev: KeyboardEvent): void => {
    const current = (ev.target as Element | null)?.closest<HTMLElement>('[role="radio"]');
    if (!current) return;
    const group = current.closest('[role="radiogroup"]');
    if (!group) return;
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    const i = radios.indexOf(current);
    let next = -1;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (i + 1) % radios.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (i - 1 + radios.length) % radios.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = radios.length - 1;
    if (next < 0) return;
    ev.preventDefault();
    radios[next]!.focus();
    radios[next]!.click();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'eyesfree-calibrator': EyesFreeCalibratorElement;
  }
  interface HTMLElementEventMap {
    'eyesfree-change': CustomEvent<CalibratorChangeDetail>;
    'eyesfree-step': CustomEvent<{ step: CalibratorStep }>;
    'eyesfree-complete': CustomEvent<CalibratorCompleteDetail>;
    'eyesfree-cancel': CustomEvent<Record<string, never>>;
  }
}
