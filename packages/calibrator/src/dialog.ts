import type { VisionProfile } from '@eyesfree/core';
import type { EyesFree } from '@eyesfree/web';
import { CALIBRATOR_EVENTS, EyesFreeCalibratorElement } from './element.js';
import type { CalibratorMessages } from './i18n.js';
import type { DistanceMonitorLike } from './element.js';

const DIALOG_STYLE_ID = 'eyesfree-dialog-styles';
const DIALOG_CSS = `
dialog.efc-dialog {
  /* Wide: from step 2 the wizard magnifies itself to be readable from a distance. */
  width: min(1100px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow: auto;
  padding: 16px; border: 0; border-radius: 24px;
  background: #ffffff; color: #0f172a;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.35);
}
dialog.efc-dialog::backdrop { background: rgba(15, 23, 42, 0.55); }
`.trim();

export interface CalibratorDialogOptions {
  engine?: EyesFree | null;
  locale?: string;
  messages?: Partial<CalibratorMessages>;
  autoApply?: boolean;
  /** Camera distance monitor (enables "Measure with the camera" in step 1). */
  distanceMonitor?: DistanceMonitorLike | null;
  /** Accessible name of the dialog. Default: the calibrator title. */
  label?: string;
  doc?: Document;
}

export interface CalibratorDialogHandle {
  /** Resolves with the chosen profile, or `null` when cancelled / dismissed. */
  result: Promise<VisionProfile | null>;
  close(): void;
  element: EyesFreeCalibratorElement;
}

/**
 * Opens the calibrator in a modal `<dialog>` — the fastest way to add a
 * "Without glasses?" button to any app.
 *
 * ```ts
 * button.onclick = async () => {
 *   const profile = await openCalibratorDialog({ engine }).result;
 * };
 * ```
 */
export function openCalibratorDialog(options: CalibratorDialogOptions = {}): CalibratorDialogHandle {
  const doc = options.doc ?? document;
  if (!doc.getElementById(DIALOG_STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = DIALOG_STYLE_ID;
    style.textContent = DIALOG_CSS;
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  if (typeof customElements !== 'undefined' && !customElements.get('eyesfree-calibrator')) {
    customElements.define('eyesfree-calibrator', EyesFreeCalibratorElement);
  }

  const dialog = doc.createElement('dialog');
  dialog.className = 'efc-dialog';
  dialog.setAttribute('data-eyesfree-ignore', '');
  const el = doc.createElement('eyesfree-calibrator') as EyesFreeCalibratorElement;
  el.engine = options.engine ?? null;
  el.autoApply = options.autoApply ?? true;
  el.distanceMonitor = options.distanceMonitor ?? null;
  if (options.messages) el.messages = options.messages;
  if (options.locale) el.setAttribute('locale', options.locale);
  dialog.appendChild(el);
  doc.body.appendChild(dialog);
  dialog.setAttribute('aria-label', options.label ?? el.querySelector('.efc-title')?.textContent ?? 'EyesFree');

  let settle!: (p: VisionProfile | null) => void;
  const result = new Promise<VisionProfile | null>((r) => (settle = r));
  let done = false;
  const finish = (p: VisionProfile | null) => {
    if (done) return;
    done = true;
    settle(p);
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    dialog.remove();
  };

  el.addEventListener(CALIBRATOR_EVENTS.complete, (e) => finish((e as CustomEvent<{ profile: VisionProfile }>).detail.profile));
  el.addEventListener(CALIBRATOR_EVENTS.cancel, () => finish(null));
  dialog.addEventListener('close', () => finish(null));

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  return { result, close: () => finish(null), element: el };
}
