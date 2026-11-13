// EyesFree demo — uses only the public browser bundle API.
import {
  mount,
  openCalibratorDialog,
  simulateDefocus,
  ImageCompensator,
  DOM_CHANGE_EVENT,
} from './vendor/eyesfree.js';

// 1. One call: engine + declarative [data-eyesfree-toggle] buttons.
const { engine } = mount({ root: '#app-root', openSelector: false });

const $ = (sel) => document.querySelector(sel);

// 2. The calibrator opens as a wide modal dialog: from step 2 it magnifies itself so it
//    stays readable from the distance the user moved back to.
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-open-calibrator]')) return;
  const handle = openCalibratorDialog({ engine, locale: $('#locale').value });
  handle.element.start();
});

// 3. React to state changes (framework-free DOM event).
const AXIS = { none: 'None', horizontal: 'Sideways', vertical: 'Vertical', diagonal45: 'Diagonal B', diagonal135: 'Diagonal A', outline: 'Outline' };
const SPACING = ['Standard', 'Soft', 'Medium', 'Wide'];
function renderStatus() {
  const { profile, plan } = engine.getState();
  $('#status-badge').textContent = plan.active ? 'No-glasses mode: ON' : 'Standard view (with glasses)';
  $('#active-banner').hidden = !plan.active;
  const tip = $('#distance-tip');
  tip.hidden = !(plan.active && plan.viewingDistanceCm);
  if (!tip.hidden) {
    const d = plan.viewingDistanceCm;
    tip.textContent = `Sit about ${d < 100 ? d + ' cm' : d / 100 + ' m'} from the screen, without glasses.`;
  }
  if (profile) {
    $('#profile-desc').textContent =
      `Size ${Math.round(profile.fontScale * 100)}% · Sharpness: ${profile.sharpness} (blur ${profile.blurRadius}px) · ` +
      `Doubled: ${AXIS[profile.ghostAxis]} · Spacing: ${SPACING[profile.crowding]}`;
  }
  const code = engine.getShareCode();
  $('#share-code').textContent = code ?? '—';
  $('#btn-copy').disabled = !code;
  drawWorkerDemo();
}
document.addEventListener(DOM_CHANGE_EVENT, renderStatus);
$('#btn-disable').addEventListener('click', () => engine.disable());
$('#btn-reset').addEventListener('click', () => engine.reset());

// 4. Developer tools.
let undoSim = null;
$('#btn-sim').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (undoSim) {
    undoSim();
    undoSim = null;
  } else {
    undoSim = simulateDefocus($('#phone'), { blurPx: Number($('#sim-strength').value) });
  }
  btn.setAttribute('aria-pressed', String(!!undoSim));
  btn.textContent = undoSim ? 'Simulate eye: ON (blurred)' : 'Simulate eye: OFF';
});
$('#sim-strength').addEventListener('change', () => {
  if (!undoSim) return;
  undoSim();
  undoSim = simulateDefocus($('#phone'), { blurPx: Number($('#sim-strength').value) });
});
$('#btn-copy').addEventListener('click', async () => {
  const url = engine.getShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    $('#btn-copy').textContent = 'Copied ✓';
  } catch {
    prompt('Copy this link', url);
  }
  setTimeout(() => ($('#btn-copy').textContent = 'Copy share link'), 1500);
});

// 5. Raster content through the Web Worker.
const compensator = new ImageCompensator();
function paintSource(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('Take 1 tablet at 2 PM', 14, 40);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('Amoxicillin 500 mg · 21 capsules', 14, 72);
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  [10, 60, 35, 80, 50, 95, 70].forEach((v, i) => ctx.lineTo(14 + i * 48, 132 - v * 0.4));
  ctx.stroke();
}
let drawSeq = 0;
async function drawWorkerDemo() {
  const seq = ++drawSeq;
  const src = $('#cv-src');
  const out = $('#cv-out');
  paintSource(src);
  paintSource(out);
  const plan = engine.getState().plan;
  const t0 = performance.now();
  await compensator.compensateCanvas(out, plan);
  if (seq !== drawSeq) return;
  const ms = (performance.now() - t0).toFixed(1);
  $('#cv-caption').textContent = plan.active
    ? `Compensated · ${compensator.usesWorker ? 'Web Worker' : 'main thread'} · ${ms} ms`
    : 'Compensated (inactive: calibrate first)';
}

engine.ready.then(renderStatus);
