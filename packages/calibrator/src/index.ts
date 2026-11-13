/**
 * @eyesfree/calibrator — `<eyesfree-calibrator>` Web Component.
 *
 * ```ts
 * import { defineCalibrator } from '@eyesfree/calibrator';
 * defineCalibrator(); // registers <eyesfree-calibrator>
 * ```
 *
 * Original project: https://github.com/rbassoi/eyesfree — Apache-2.0
 */
import { EyesFreeCalibratorElement } from './element.js';

export { CALIBRATOR_EVENTS, EyesFreeCalibratorElement, GHOST_OPTIONS, SHARPNESS_OPTIONS } from './element.js';
export type { CalibratorChangeDetail, CalibratorCompleteDetail, CalibratorStep } from './element.js';
export { en, es, formatStep, LOCALES, mergeMessages, ptBR, registerLocale, resolveLocale } from './i18n.js';
export type { CalibratorMessages } from './i18n.js';
export { CALIBRATOR_CSS, CALIBRATOR_STYLE_ID, ensureCalibratorStyles } from './styles.js';
export { openCalibratorDialog } from './dialog.js';
export type { CalibratorDialogHandle, CalibratorDialogOptions } from './dialog.js';

export const CALIBRATOR_TAG = 'eyesfree-calibrator';

/**
 * Registers the custom element (safe to call many times; no-op during SSR).
 * @returns the element constructor registered for `tagName`, or `undefined` without DOM.
 */
export function defineCalibrator(tagName: string = CALIBRATOR_TAG): CustomElementConstructor | undefined {
  if (typeof customElements === 'undefined') return undefined;
  const existing = customElements.get(tagName);
  if (existing) return existing;
  // A subclass per tag name lets you register it under several names.
  const ctor = tagName === CALIBRATOR_TAG ? EyesFreeCalibratorElement : class extends EyesFreeCalibratorElement {};
  customElements.define(tagName, ctor);
  return ctor;
}
