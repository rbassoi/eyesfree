import { distanceStatus } from '@eyesfree/core';
import type { DistanceStatus } from '@eyesfree/core';
import type { EyesFree } from '@eyesfree/web';
import type { DistanceMonitor, DistanceReading } from './monitor.js';

export interface DistanceGuardMessages {
  /** Templates with `{measured}` and `{target}`. */
  tooClose: string;
  tooFar: string;
  ok: string;
  noFace: string;
  stop: string;
}

export const GUARD_MESSAGES: Record<string, DistanceGuardMessages> = {
  en: {
    tooClose: 'Move back a little: you are about {measured} away, the best is {target}.',
    tooFar: 'You can come a little closer (about {target}).',
    ok: 'Good distance ✓',
    noFace: 'Camera on: face not found.',
    stop: 'Turn off camera',
  },
  pt: {
    tooClose: 'Afaste-se um pouco: você está a cerca de {measured}, o ideal é {target}.',
    tooFar: 'Pode se aproximar um pouco (cerca de {target}).',
    ok: 'Distância boa ✓',
    noFace: 'Câmera ligada: rosto não encontrado.',
    stop: 'Desligar câmera',
  },
  es: {
    tooClose: 'Aléjese un poco: está a unos {measured}, lo ideal es {target}.',
    tooFar: 'Puede acercarse un poco (unos {target}).',
    ok: 'Buena distancia ✓',
    noFace: 'Cámara encendida: no se encuentra el rostro.',
    stop: 'Apagar cámara',
  },
};

export interface DistanceGuardOptions {
  engine: EyesFree;
  monitor: DistanceMonitor;
  /** BCP-47 locale. Default: `<html lang>` or `en`. */
  locale?: string;
  messages?: Partial<DistanceGuardMessages>;
  /** Relative tolerance before warning. Default 0.2 (±20 %). */
  tolerance?: number;
  /** Also show a brief "good distance" confirmation. Default true. */
  showOk?: boolean;
  /** Called on every status change (for your own UI / analytics-free logging). */
  onStatus?: (status: DistanceStatus | 'no-face' | 'idle', reading: DistanceReading) => void;
  document?: Document;
}

const fmt = (cm: number) => (cm < 100 ? `${Math.round(cm / 5) * 5} cm` : `${Math.round(cm / 10) / 10} m`);

const CSS = `
.eyesfree-guard {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
  z-index: 2147483000; max-width: calc(100vw - 24px);
  display: flex; align-items: center; gap: 12px;
  background: #0f172a; color: #fff; border-radius: 999px;
  padding: 10px 12px 10px 20px; box-shadow: 0 10px 30px rgba(0,0,0,.35);
  font: 700 1.1rem/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.eyesfree-guard[data-status="too-close"] { background: #b45309; }
.eyesfree-guard[data-status="ok"] { background: #047857; }
.eyesfree-guard[hidden] { display: none; }
.eyesfree-guard button {
  font: inherit; font-size: .8em; cursor: pointer; color: inherit; background: rgba(255,255,255,.18);
  border: 0; border-radius: 999px; padding: 8px 12px; min-height: 40px;
}
`.trim();

/**
 * Shows a large on-screen hint when the user is closer (or much farther) than the distance
 * at which they see sharply (`profile.viewingDistance`). Text is magnified with the profile's
 * `fontScale` so it is readable from the chair.
 *
 * @returns a function that removes the guard (it does not stop the camera).
 */
export function createDistanceGuard(options: DistanceGuardOptions): () => void {
  const doc = options.document ?? document;
  const locale = (options.locale ?? doc.documentElement.lang ?? 'en').split('-')[0]!.toLowerCase();
  const m: DistanceGuardMessages = { ...(GUARD_MESSAGES[locale] ?? GUARD_MESSAGES.en!), ...(options.messages ?? {}) };
  const tolerance = options.tolerance ?? 0.2;

  if (!doc.getElementById('eyesfree-guard-styles')) {
    const style = doc.createElement('style');
    style.id = 'eyesfree-guard-styles';
    style.textContent = CSS;
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  const el = doc.createElement('div');
  el.className = 'eyesfree-guard';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('data-eyesfree-ignore', '');
  el.hidden = true;
  const text = doc.createElement('span');
  const stop = doc.createElement('button');
  stop.type = 'button';
  stop.textContent = `📷 ${m.stop}`;
  stop.addEventListener('click', () => options.monitor.stop());
  el.append(text, stop);
  doc.body.appendChild(el);

  let okTimer: ReturnType<typeof setTimeout> | null = null;
  let lastStatus = '';

  const render = () => {
    const reading = options.monitor.getReading();
    const { profile, plan } = options.engine.getState();
    const target = plan.active ? (profile?.viewingDistance ?? 0) : 0;
    el.style.fontSize = `calc(1.1rem * ${plan.active ? plan.fontScale : 1})`;

    let status: DistanceStatus | 'no-face' | 'idle' = 'idle';
    if (!options.monitor.running || !target) status = 'idle';
    else if (reading.status === 'no-face' || reading.status === 'starting') status = 'no-face';
    else if (reading.cm !== null) status = distanceStatus(reading.cm, target, tolerance);

    el.dataset.status = status;
    if (status === 'too-close') text.textContent = m.tooClose.replace('{measured}', fmt(reading.cm!)).replace('{target}', fmt(target));
    else if (status === 'too-far') text.textContent = m.tooFar.replace('{target}', fmt(target));
    else if (status === 'no-face') text.textContent = m.noFace;
    else if (status === 'ok') text.textContent = m.ok;

    if (status !== lastStatus) {
      lastStatus = status;
      options.onStatus?.(status, reading);
      if (okTimer) clearTimeout(okTimer);
      okTimer = null;
      if (status === 'ok') {
        el.hidden = options.showOk === false;
        okTimer = setTimeout(() => (el.hidden = true), 2500);
      } else {
        el.hidden = status === 'idle';
      }
    }
  };

  const unsubMonitor = options.monitor.subscribe(render);
  const unsubEngine = options.engine.subscribe(render);
  render();

  return () => {
    unsubMonitor();
    unsubEngine();
    if (okTimer) clearTimeout(okTimer);
    el.remove();
  };
}
