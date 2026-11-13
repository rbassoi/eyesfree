export const CALIBRATOR_STYLE_ID = 'eyesfree-calibrator-styles';

/**
 * Calibrator styles. Theme with CSS custom properties on the element, e.g.
 * `eyesfree-calibrator { --efc-accent: #6d28d9; }`.
 *
 * The sample areas deliberately keep a fixed light-grey background (`--efc-sample-bg`):
 * the bright halos created by the deconvolution need luminance headroom to be visible.
 */
export const CALIBRATOR_CSS = `
eyesfree-calibrator {
  --efc-accent: #1d4ed8;
  --efc-accent-contrast: #ffffff;
  --efc-confirm: #047857;
  --efc-fg: #0f172a;
  --efc-muted: #334155;
  --efc-panel-bg: #eff6ff;
  --efc-panel-border: #bfdbfe;
  --efc-card-border: #cbd5e1;
  --efc-sample-bg: #e4e7ec;
  --efc-radius: 18px;
  --efc-font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  display: block;
  color: var(--efc-fg);
  font-family: var(--efc-font);
  -webkit-text-size-adjust: 100%;
}
eyesfree-calibrator[hidden] { display: none; }
eyesfree-calibrator * { box-sizing: border-box; }
.efc { display: flex; flex-direction: column; gap: 16px; }
.efc-panel {
  background: var(--efc-panel-bg);
  border: 2px solid var(--efc-panel-border);
  border-radius: var(--efc-radius);
  padding: 14px 16px;
}
.efc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.efc-title { font-size: 0.8rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--efc-accent); margin: 0; }
.efc-step {
  font-size: 0.8rem; font-weight: 700; white-space: nowrap;
  background: var(--efc-accent); color: var(--efc-accent-contrast);
  border-radius: 999px; padding: 2px 10px;
}
.efc-instruction { margin: 0; font-size: 1.05rem; line-height: 1.4; font-weight: 500; }
.efc-instruction:focus { outline: none; }
.efc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.efc-list { display: flex; flex-direction: column; gap: 10px; }
.efc-card {
  appearance: none; font: inherit; color: inherit; cursor: pointer; text-align: center;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 56px; padding: 14px 10px;
  background: var(--efc-sample-bg);
  border: 2px solid var(--efc-card-border);
  border-radius: var(--efc-radius);
  transition: border-color 120ms, box-shadow 120ms;
}
.efc-list .efc-card { align-items: flex-start; text-align: left; padding: 14px 16px; }
.efc-card:hover { border-color: var(--efc-accent); }
.efc-card:focus-visible { outline: 3px solid var(--efc-accent); outline-offset: 2px; }
.efc-card[aria-checked="true"] {
  border-color: var(--efc-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--efc-accent) 35%, transparent);
}
.efc-card-label { font-size: 0.8rem; font-weight: 700; color: var(--efc-muted); }
.efc-list .efc-card-label { color: var(--efc-accent); text-transform: uppercase; letter-spacing: 0.02em; }
.efc-card-row { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; }
.efc-badge {
  font-size: 0.7rem; font-weight: 700; white-space: nowrap;
  background: var(--efc-accent); color: var(--efc-accent-contrast); border-radius: 999px; padding: 2px 8px;
}
.efc-hint { font-size: 0.8rem; color: var(--efc-muted); }
.efc-sample {
  display: block; color: #0f172a; background: var(--efc-sample-bg);
  padding: 4px 6px; border-radius: 6px;
}
/* The clip box hides the padded filter region of large-radius previews. */
.efc-clip { display: block; overflow: hidden; border-radius: 8px; max-width: 100%; }
.efc-list .efc-clip { width: 100%; }
.efc-sample-stack { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 10px; }
.efc-sample-letters { display: block; font-size: 1.9em; font-weight: 800; letter-spacing: 0.05em; line-height: 1.2; }
.efc-sample-word { display: block; font-size: 0.8em; font-weight: 600; }
/* Step 1: big sample the user moves away from until it looks sharp. */
.efc-distance-sample {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: #ffffff; border: 2px solid var(--efc-card-border); border-radius: var(--efc-radius);
  padding: 18px 12px; color: #0f172a; text-align: center;
}
.efc-distance-letters { font-size: 3rem; font-weight: 800; letter-spacing: 0.08em; line-height: 1.1; }
.efc-distance-text { font-size: 1.5rem; font-weight: 700; }
.efc-list-compact { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.efc-card-label-lg { font-size: 1rem; color: var(--efc-fg); }
.efc-sample-text { font-size: 1.15rem; font-weight: 700; line-height: 1.35; }
.efc-slider {
  display: block; background: #f1f5f9; border: 1px solid var(--efc-card-border);
  border-radius: var(--efc-radius); padding: 12px 14px;
}
.efc-slider-label { display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 6px; }
.efc-slider input { width: 100%; accent-color: var(--efc-accent); min-height: 32px; }
.efc-actions { display: flex; gap: 8px; }
.efc-btn {
  appearance: none; font: inherit; cursor: pointer;
  min-height: 56px; padding: 12px 16px; border-radius: var(--efc-radius);
  font-size: 1rem; font-weight: 800;
  border: 2px solid #94a3b8; background: transparent; color: var(--efc-fg);
}
.efc-btn:focus-visible { outline: 3px solid var(--efc-accent); outline-offset: 2px; }
.efc-btn-secondary { flex: 1 1 33%; }
.efc-actions { flex-wrap: wrap; }
.efc-btn-primary { flex: 2 1 67%; background: var(--efc-accent); border-color: var(--efc-accent); color: var(--efc-accent-contrast); }
.efc-btn-confirm { flex: 2 1 67%; background: var(--efc-confirm); border-color: var(--efc-confirm); color: #fff; }
@media (max-width: 340px) { .efc-grid { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .efc-card { transition: none; } }
`.trim();

export function ensureCalibratorStyles(doc: Document, nonce?: string): void {
  if (doc.getElementById(CALIBRATOR_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = CALIBRATOR_STYLE_ID;
  if (nonce) style.setAttribute('nonce', nonce);
  style.textContent = CALIBRATOR_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}
