/**
 * eyesfree browser bundle — everything in one file, no build step required.
 *
 * ```html
 * <script src="https://unpkg.com/@eyesfree/browser/dist/eyesfree.min.js"></script>
 * <script>
 *   const { engine } = eyesfree.mount({ root: '#app' });
 *   document.querySelector('#glasses').onclick = () => eyesfree.openCalibratorDialog({ engine });
 * </script>
 * ```
 *
 * Zero-code: `<script src="…/eyesfree.min.js" data-eyesfree-auto data-root="#app"></script>`
 * and any element with `data-eyesfree-open` opens the calibrator.
 *
 * Original project: https://github.com/rbassoi/eyesfree — Apache-2.0
 */
import { createEyesFree } from '@eyesfree/web';
import type { EyesFree, EyesFreeOptions } from '@eyesfree/web';
import { defineCalibrator, openCalibratorDialog } from '@eyesfree/calibrator';
import type { CalibratorDialogHandle } from '@eyesfree/calibrator';

export * from '@eyesfree/core';
export * from '@eyesfree/web';
export * from '@eyesfree/calibrator';

export interface MountOptions extends EyesFreeOptions {
  /** Locale for the calibrator dialog. */
  locale?: string;
  /** Wire up elements matching this selector to open the calibrator. Default `[data-eyesfree-open]`. */
  openSelector?: string | false;
  /** Wire up elements matching this selector to toggle compensation. Default `[data-eyesfree-toggle]`. */
  toggleSelector?: string | false;
}

export interface MountResult {
  engine: EyesFree;
  /** Opens the calibrator in a modal dialog. */
  open(): CalibratorDialogHandle;
  /** Removes listeners and rendering. */
  destroy(): void;
}

/** One-call integration: engine + calibrator element + declarative buttons. */
export function mount(options: MountOptions = {}): MountResult {
  defineCalibrator();
  const engine = createEyesFree(options);
  const open = () => openCalibratorDialog({ engine, ...(options.locale ? { locale: options.locale } : {}) });

  const openSel = options.openSelector ?? '[data-eyesfree-open]';
  const toggleSel = options.toggleSelector ?? '[data-eyesfree-toggle]';
  const onClick = (ev: Event) => {
    const t = ev.target as Element | null;
    if (!t || typeof t.closest !== 'function') return;
    if (openSel && t.closest(openSel)) {
      ev.preventDefault();
      open();
    } else if (toggleSel && t.closest(toggleSel)) {
      ev.preventDefault();
      engine.toggle();
    }
  };
  const doc = options.document ?? document;
  doc.addEventListener('click', onClick);

  return {
    engine,
    open,
    destroy() {
      doc.removeEventListener('click', onClick);
      engine.destroy();
    },
  };
}

// Zero-code auto-mount from the <script> tag's data attributes.
if (typeof document !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script && script.hasAttribute('data-eyesfree-auto')) {
    const d = script.dataset;
    const start = () => {
      const result = mount({
        ...(d.root ? { root: d.root } : {}),
        ...(d.locale ? { locale: d.locale } : {}),
        ...(d.scope ? { scope: d.scope as MountOptions['scope'] } : {}),
        ...(d.storageKey ? { storageKey: d.storageKey } : {}),
      });
      (window as unknown as { eyesfreeInstance?: MountResult }).eyesfreeInstance = result;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
}
