import { distanceStatus } from '@eyesfree/core';
import type { DistanceStatus } from '@eyesfree/core';
import type { EyesFree } from '@eyesfree/web';
import type { CameraErrorCode, DistanceMonitor, DistanceReading } from './monitor.js';

export interface DistanceGuardMessages {
  /** Templates with `{measured}` and `{target}`. */
  tooClose: string;
  tooFar: string;
  ok: string;
  noFace: string;
  stop: string;
  /** Compact indicator while the camera is on and the distance is fine (template `{measured}`). */
  on: string;
  starting: string;
  errors: Record<CameraErrorCode, string>;
}

export const GUARD_MESSAGES: Record<string, DistanceGuardMessages> = {
  en: {
    tooClose: 'Move back a little: you are about {measured} away, the best is {target}.',
    tooFar: 'You can come a little closer (about {target}).',
    ok: 'Good distance ✓',
    noFace: 'Camera on: face not found.',
    stop: 'Turn off camera',
    on: '📷 Camera on · ≈ {measured}',
    starting: '📷 Starting the camera…',
    errors: {
      denied: 'Camera blocked. Click the camera icon in the address bar and allow it, then try again.',
      'no-camera': 'No camera was found on this device.',
      busy: 'The camera is being used by another app. Close it and try again.',
      insecure: 'The camera needs a secure (https) page.',
      'load-failed': 'Could not download the face detector. Check the internet connection or ad blocker.',
      timeout: 'The camera took too long to start. Try again.',
      unknown: 'The camera could not start.',
    },
  },
  pt: {
    tooClose: 'Afaste-se um pouco: você está a cerca de {measured}, o ideal é {target}.',
    tooFar: 'Pode se aproximar um pouco (cerca de {target}).',
    ok: 'Distância boa ✓',
    noFace: 'Câmera ligada: rosto não encontrado.',
    stop: 'Desligar câmera',
    on: '📷 Câmera ligada · ≈ {measured}',
    starting: '📷 Ligando a câmera…',
    errors: {
      denied: 'Câmera bloqueada. Clique no ícone de câmera na barra de endereço, permita e tente de novo.',
      'no-camera': 'Nenhuma câmera foi encontrada neste aparelho.',
      busy: 'A câmera está sendo usada por outro programa. Feche-o e tente de novo.',
      insecure: 'A câmera precisa de uma página segura (https).',
      'load-failed': 'Não foi possível baixar o detector de rosto. Verifique a internet ou o bloqueador de anúncios.',
      timeout: 'A câmera demorou demais para ligar. Tente de novo.',
      unknown: 'Não foi possível ligar a câmera.',
    },
  },
  es: {
    tooClose: 'Aléjese un poco: está a unos {measured}, lo ideal es {target}.',
    tooFar: 'Puede acercarse un poco (unos {target}).',
    ok: 'Buena distancia ✓',
    noFace: 'Cámara encendida: no se encuentra el rostro.',
    stop: 'Apagar cámara',
    on: '📷 Cámara encendida · ≈ {measured}',
    starting: '📷 Encendiendo la cámara…',
    errors: {
      denied: 'Cámara bloqueada. Haga clic en el icono de cámara de la barra de direcciones, permítala y vuelva a intentar.',
      'no-camera': 'No se encontró ninguna cámara en este dispositivo.',
      busy: 'Otra aplicación está usando la cámara. Ciérrela y vuelva a intentar.',
      insecure: 'La cámara necesita una página segura (https).',
      'load-failed': 'No se pudo descargar el detector de rostros. Revise la conexión o el bloqueador de anuncios.',
      timeout: 'La cámara tardó demasiado en encender. Vuelva a intentar.',
      unknown: 'No se pudo encender la cámara.',
    },
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
  /**
   * Keep a compact "camera on" indicator visible whenever the camera runs (privacy).
   * Default true.
   */
  indicator?: boolean;
  /** Called on every status change (for your own UI / analytics-free logging). */
  onStatus?: (status: GuardStatus, reading: DistanceReading) => void;
  document?: Document;
}

export type GuardStatus = DistanceStatus | 'no-face' | 'idle' | 'on' | 'starting' | 'error';

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
.eyesfree-guard[data-status="error"] { background: #b91c1c; border-radius: 20px; }
.eyesfree-guard[data-status="on"], .eyesfree-guard[data-status="starting"] { font-size: .85rem !important; opacity: .92; padding: 6px 8px 6px 14px; }
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
  const base = GUARD_MESSAGES[locale] ?? GUARD_MESSAGES.en!;
  const m: DistanceGuardMessages = {
    ...base,
    ...(options.messages ?? {}),
    errors: { ...base.errors, ...(options.messages?.errors ?? {}) },
  };
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
  stop.addEventListener('click', () => {
    if (options.monitor.getReading().status === 'error') {
      el.hidden = true;
      lastStatus = 'idle';
    } else options.monitor.stop();
  });
  el.append(text, stop);
  doc.body.appendChild(el);

  let okTimer: ReturnType<typeof setTimeout> | null = null;
  let lastStatus = '';

  const render = () => {
    const reading = options.monitor.getReading();
    const { profile, plan } = options.engine.getState();
    const target = plan.active ? (profile?.viewingDistance ?? 0) : 0;
    el.style.fontSize = `calc(1.1rem * ${plan.active ? plan.fontScale : 1})`;

    const indicator = options.indicator !== false;
    let status: GuardStatus = 'idle';
    if (reading.status === 'error') status = 'error';
    else if (reading.status === 'starting') status = 'starting';
    else if (!options.monitor.running) status = 'idle';
    else if (reading.status === 'no-face') status = 'no-face';
    else if (!target) status = 'on';
    else if (reading.cm !== null) status = distanceStatus(reading.cm, target, tolerance);

    el.dataset.status = status;
    stop.hidden = status === 'idle';
    stop.textContent = status === 'error' ? '✕' : `📷 ${m.stop}`;
    stop.setAttribute('aria-label', status === 'error' ? 'Close' : m.stop);
    if (status === 'too-close') text.textContent = m.tooClose.replace('{measured}', fmt(reading.cm!)).replace('{target}', fmt(target));
    else if (status === 'too-far') text.textContent = m.tooFar.replace('{target}', fmt(target));
    else if (status === 'no-face') text.textContent = m.noFace;
    else if (status === 'ok') text.textContent = m.ok;
    else if (status === 'on') text.textContent = m.on.replace('{measured}', reading.cm !== null ? fmt(reading.cm) : '…');
    else if (status === 'starting') text.textContent = m.starting;
    else if (status === 'error') text.textContent = m.errors[reading.errorCode ?? 'unknown'];

    // While the camera runs, a compact indicator replaces the hidden "ok" state (privacy).
    const showCompactOn = indicator && options.monitor.running && reading.cm !== null;
    if (status !== lastStatus) {
      lastStatus = status;
      options.onStatus?.(status, reading);
      if (okTimer) clearTimeout(okTimer);
      okTimer = null;
      if (status === 'ok') {
        el.hidden = options.showOk === false && !indicator;
        okTimer = setTimeout(() => {
          if (indicator && options.monitor.running) {
            el.dataset.status = 'on';
            text.textContent = m.on.replace('{measured}', fmt(options.monitor.getReading().cm ?? target));
          } else el.hidden = true;
        }, 2500);
      } else {
        el.hidden = status === 'idle' || (status === 'on' && !indicator);
      }
    } else if (status === 'ok' && !okTimer && showCompactOn) {
      el.dataset.status = 'on';
      text.textContent = m.on.replace('{measured}', fmt(reading.cm!));
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
