import { createRenderPlan, DEFAULT_PROFILE, normalizeProfile } from '@eyesfree/core';
import type { CrowdingLevel, GhostAxis, RenderPlan, SharpnessLevel, VisionProfile } from '@eyesfree/core';
import { applyPreview, removeFilter } from '@eyesfree/web';
import type { EyesFree } from '@eyesfree/web';
import { formatStep, mergeMessages, resolveLocale } from './i18n.js';
import type { CalibratorMessages } from './i18n.js';
import { ensureCalibratorStyles } from './styles.js';

/** Order of the step-1 cards (matches the original prototype). */
export const GHOST_OPTIONS: readonly GhostAxis[] = ['none', 'horizontal', 'vertical', 'diagonal135', 'diagonal45', 'outline'];
/** Order of the step-2 options. */
export const SHARPNESS_OPTIONS: readonly SharpnessLevel[] = ['none', 'mild', 'medium', 'strong'];

export type CalibratorStep = 1 | 2;

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

let uidCounter = 0;

// SSR-safe base class.
const BaseElement: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

/**
 * `<eyesfree-calibrator>` — the two-step perceptual calibration wizard.
 *
 * Attributes: `locale`, `sample-letters`, `sample-text`, `nonce`, `hide-cancel`.
 * Properties: `engine`, `autoApply`, `messages`, `profile`, `step`.
 * Events: `eyesfree-change`, `eyesfree-step`, `eyesfree-complete`, `eyesfree-cancel`.
 *
 * Works in plain HTML, React, Vue, Angular, Svelte, Lit, Solid, Ionic, Capacitor, etc.
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

  /** Current step (1 = ghost cancellation, 2 = sharpness + spacing). */
  get step(): CalibratorStep {
    return this._step;
  }
  set step(value: CalibratorStep) {
    this.goTo(value);
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
    this._step = step === 2 ? 2 : 1;
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

  private release(): void {
    this.releaseEngine?.();
    this.releaseEngine = null;
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

  private get msgs(): CalibratorMessages {
    const locale = this.getAttribute('locale') ?? this.ownerDocument?.documentElement?.lang ?? 'en';
    return mergeMessages(resolveLocale(locale), this._messages);
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

  private render(): void {
    const m = this.msgs;
    const p = this.profile;
    const total = 2;
    const letters = esc(this.getAttribute('sample-letters') ?? m.sampleLetters);
    const sentence = esc(this.getAttribute('sample-text') ?? m.sampleText);
    const hideCancel = this.hasAttribute('hide-cancel');

    const head = `
      <div class="efc-panel" part="panel">
        <div class="efc-head">
          <p class="efc-title">${esc(m.title)}</p>
          <span class="efc-step" aria-live="polite">${esc(formatStep(m.stepIndicator, this._step, total))}</span>
        </div>
        <p class="efc-instruction" tabindex="-1">${esc(this._step === 1 ? m.step1Instruction : m.step2Instruction)}</p>
      </div>`;

    let body: string;
    if (this._step === 1) {
      body = `
      <div class="efc-grid" role="radiogroup" aria-label="${esc(m.ghostGroupLabel)}" data-group="ghost">
        ${GHOST_OPTIONS.map((axis) => {
          const checked = p.ghostAxis === axis;
          return `
          <button type="button" class="efc-card" part="card" role="radio" aria-checked="${checked}"
            tabindex="${checked ? 0 : -1}" data-ghost="${axis}">
            <span class="efc-card-label">${esc(m.ghost[axis])}</span>
            <span class="efc-sample efc-sample-letters" data-preview-ghost="${axis}" aria-hidden="true">${letters}</span>
            <span class="efc-sample efc-sample-word" data-preview-ghost="${axis}" aria-hidden="true">${esc(m.sampleWord)}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="efc-actions">
        ${hideCancel ? '' : `<button type="button" class="efc-btn efc-btn-secondary" data-action="cancel">${esc(m.cancel)}</button>`}
        <button type="button" class="efc-btn efc-btn-primary" data-action="next">${esc(m.next)} →</button>
      </div>`;
    } else {
      body = `
      <div class="efc-list" role="radiogroup" aria-label="${esc(m.sharpnessGroupLabel)}" data-group="sharpness">
        ${SHARPNESS_OPTIONS.map((level) => {
          const checked = p.sharpness === level;
          const info = m.sharpness[level];
          return `
          <button type="button" class="efc-card" part="card" role="radio" aria-checked="${checked}"
            tabindex="${checked ? 0 : -1}" data-sharpness="${level}">
            <span class="efc-card-row">
              <span class="efc-card-label">${esc(info.label)}</span>
              ${level === 'medium' ? `<span class="efc-badge">${esc(m.mostChosen)}</span>` : ''}
            </span>
            <span class="efc-hint">${esc(info.hint)}</span>
            <span class="efc-sample efc-sample-text" data-preview-sharpness="${level}">${sentence}</span>
          </button>`;
        }).join('')}
      </div>
      <label class="efc-slider">
        <span class="efc-slider-label">${esc(m.spacingLabel)}: <output data-spacing-label>${esc(m.spacingLevels[p.crowding])}</output></span>
        <input type="range" min="0" max="3" step="1" value="${p.crowding}" data-input="crowding"
          aria-valuetext="${esc(m.spacingLevels[p.crowding])}" />
      </label>
      <div class="efc-actions">
        <button type="button" class="efc-btn efc-btn-secondary" data-action="back">← ${esc(m.back)}</button>
        <button type="button" class="efc-btn efc-btn-confirm" data-action="apply">${esc(m.apply)} ✓</button>
      </div>`;
    }

    this.innerHTML = `<div class="efc" part="container">${head}${body}</div>`;
    this.updatePreviews();
  }

  /** Re-applies the inline optical previews for the current step. */
  private updatePreviews(): void {
    const p = this.profile;
    const base = { surfaceCompensation: p.surfaceCompensation, intensity: p.intensity, enabled: true };
    if (this._step === 1) {
      for (const axis of GHOST_OPTIONS) {
        const plan = this.previewPlan({ ...base, ghostAxis: axis, sharpness: 'none', crowding: 0 });
        this.querySelectorAll<HTMLElement>(`[data-preview-ghost="${axis}"]`).forEach((el) =>
          applyPreview(el, plan, { filterId: this.filterId(`ghost-${axis}`) }),
        );
      }
    } else {
      for (const level of SHARPNESS_OPTIONS) {
        const plan = this.previewPlan({ ...base, ghostAxis: p.ghostAxis, sharpness: level, crowding: p.crowding });
        const el = this.querySelector<HTMLElement>(`[data-preview-sharpness="${level}"]`);
        if (el) applyPreview(el, plan, { filterId: this.filterId(`sharp-${level}`) });
      }
    }
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
    // Update radio state without re-rendering (keeps focus and avoids flicker).
    this.querySelectorAll<HTMLElement>('[role="radio"]').forEach((el) => {
      const checked =
        (el.dataset.ghost !== undefined && el.dataset.ghost === this._draft!.ghostAxis) ||
        (el.dataset.sharpness !== undefined && el.dataset.sharpness === this._draft!.sharpness);
      el.setAttribute('aria-checked', String(checked));
      el.tabIndex = checked ? 0 : -1;
    });
    if (patch.crowding !== undefined) this.updatePreviews();
    this.fire<CalibratorChangeDetail>(CALIBRATOR_EVENTS.change, { profile: this._draft, step: this._step });
  }

  private onClick = (ev: Event): void => {
    const target = (ev.target as Element | null)?.closest<HTMLElement>('[data-ghost],[data-sharpness],[data-action]');
    if (!target || !this.contains(target)) return;
    if (target.dataset.ghost) this.select({ ghostAxis: target.dataset.ghost as GhostAxis });
    else if (target.dataset.sharpness) this.select({ sharpness: target.dataset.sharpness as SharpnessLevel });
    else {
      switch (target.dataset.action) {
        case 'next':
          this.goTo(2);
          break;
        case 'back':
          this.goTo(1);
          break;
        case 'apply':
          this.complete();
          break;
        case 'cancel':
          this.cancel();
          break;
      }
    }
  };

  private onInput = (ev: Event): void => {
    const input = ev.target as HTMLInputElement | null;
    if (!input || input.dataset.input !== 'crowding') return;
    const level = Number(input.value) as CrowdingLevel;
    const label = this.msgs.spacingLevels[level];
    input.setAttribute('aria-valuetext', label);
    const out = this.querySelector('[data-spacing-label]');
    if (out) out.textContent = label;
    this.select({ crowding: level });
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
