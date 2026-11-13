/**
 * @eyesfree/react — React bindings for EyesFree (web / Next.js / Remix / Vite / Electron).
 *
 * ```tsx
 * <EyesFreeProvider options={{ root: '#root' }}>
 *   <App />
 * </EyesFreeProvider>
 *
 * const { active, toggle } = useEyesFree();
 * <EyesFreeCalibrator onComplete={() => navigate('/')} />
 * ```
 *
 * Original project: https://github.com/rbassoi/eyesfree — Apache-2.0
 */
import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { EyesFree } from '@eyesfree/web';
import type { EyesFreeOptions, EyesFreeState } from '@eyesfree/web';
import { CALIBRATOR_EVENTS, CALIBRATOR_TAG, defineCalibrator } from '@eyesfree/calibrator';
import type { CalibratorMessages, CalibratorStep, EyesFreeCalibratorElement } from '@eyesfree/calibrator';
import type { RenderPlan, VisionProfile } from '@eyesfree/core';

export type { EyesFreeOptions, EyesFreeState } from '@eyesfree/web';
export type { VisionProfile, RenderPlan } from '@eyesfree/core';

const EyesFreeContext = createContext<EyesFree | null>(null);

export interface EyesFreeProviderProps {
  children?: ReactNode;
  /** Engine options (read once, on mount). Ignored when `engine` is given. */
  options?: EyesFreeOptions;
  /** Bring your own engine (e.g. shared with non-React code). */
  engine?: EyesFree;
}

/** Creates (or receives) an EyesFree engine, initialises it and provides it to the tree. */
export function EyesFreeProvider({ children, options, engine }: EyesFreeProviderProps) {
  // Lazily created once; options are intentionally read only on first render.
  const [instance] = useState<EyesFree>(() => engine ?? new EyesFree(options));
  useEffect(() => {
    void instance.init();
    return () => {
      if (!engine) instance.destroy();
    };
  }, [instance, engine]);
  return createElement(EyesFreeContext.Provider, { value: instance }, children);
}

/** Returns the engine from context. Throws when used outside `<EyesFreeProvider>`. */
export function useEyesFreeEngine(): EyesFree {
  const engine = useContext(EyesFreeContext);
  if (!engine) throw new Error('[eyesfree] useEyesFree must be used inside <EyesFreeProvider>');
  return engine;
}

export interface UseEyesFreeResult extends EyesFreeState {
  engine: EyesFree;
  active: boolean;
  apply: (profile: Partial<VisionProfile>) => VisionProfile;
  update: (patch: Partial<VisionProfile>) => VisionProfile;
  enable: () => VisionProfile;
  disable: () => VisionProfile | null;
  toggle: () => VisionProfile | null;
  reset: () => void;
  shareCode: string | null;
}

/** Reactive EyesFree state + actions. */
export function useEyesFree(): UseEyesFreeResult {
  const engine = useEyesFreeEngine();
  const state = useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getState(),
    () => engine.getState(),
  );
  return useMemo(
    () => ({
      ...state,
      engine,
      active: state.plan.active,
      apply: (p: Partial<VisionProfile>) => engine.apply(p),
      update: (p: Partial<VisionProfile>) => engine.update(p),
      enable: () => engine.enable(),
      disable: () => engine.disable(),
      toggle: () => engine.toggle(),
      reset: () => engine.reset(),
      shareCode: engine.getShareCode(),
    }),
    [engine, state],
  );
}

/** Just the render plan — e.g. to style a canvas or a third-party widget yourself. */
export function useEyesFreePlan(): RenderPlan {
  return useEyesFree().plan;
}

export interface EyesFreeCalibratorProps {
  /** BCP-47 locale (`en`, `pt-BR`, `es`, or one you registered). */
  locale?: string;
  messages?: Partial<CalibratorMessages>;
  /** Apply the result to the engine from context. Default `true`. */
  autoApply?: boolean;
  /** Starting profile (defaults to the current one). */
  initialProfile?: Partial<VisionProfile>;
  sampleLetters?: string;
  sampleText?: string;
  hideCancel?: boolean;
  onComplete?: (profile: VisionProfile) => void;
  onCancel?: () => void;
  onChange?: (profile: VisionProfile, step: CalibratorStep) => void;
  onStep?: (step: CalibratorStep) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * React wrapper around `<eyesfree-calibrator>`. Works with or without a provider (without
 * one, nothing is applied automatically — handle `onComplete` yourself).
 */
export function EyesFreeCalibrator(props: EyesFreeCalibratorProps) {
  defineCalibrator();
  const engine = useContext(EyesFreeContext);
  const ref = useRef<EyesFreeCalibratorElement | null>(null);
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.engine = engine;
    el.autoApply = props.autoApply ?? true;
    el.messages = props.messages ?? null;
  }, [engine, props.autoApply, props.messages]);

  useEffect(() => {
    // Starts a session: loads the initial/current profile and suspends the engine so the
    // previews are not compensated twice. Only on mount: later changes would reset progress.
    ref.current?.start(props.initialProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onComplete = (e: Event) => handlers.current.onComplete?.((e as CustomEvent).detail.profile);
    const onCancel = () => handlers.current.onCancel?.();
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail;
      handlers.current.onChange?.(d.profile, d.step);
    };
    const onStep = (e: Event) => handlers.current.onStep?.((e as CustomEvent).detail.step);
    el.addEventListener(CALIBRATOR_EVENTS.complete, onComplete);
    el.addEventListener(CALIBRATOR_EVENTS.cancel, onCancel);
    el.addEventListener(CALIBRATOR_EVENTS.change, onChange);
    el.addEventListener(CALIBRATOR_EVENTS.step, onStep);
    return () => {
      el.removeEventListener(CALIBRATOR_EVENTS.complete, onComplete);
      el.removeEventListener(CALIBRATOR_EVENTS.cancel, onCancel);
      el.removeEventListener(CALIBRATOR_EVENTS.change, onChange);
      el.removeEventListener(CALIBRATOR_EVENTS.step, onStep);
    };
  }, []);

  const attrs: Record<string, unknown> = {
    ref,
    className: props.className,
    style: props.style,
    locale: props.locale,
    'sample-letters': props.sampleLetters,
    'sample-text': props.sampleText,
  };
  if (props.hideCancel) attrs['hide-cancel'] = '';
  return createElement(CALIBRATOR_TAG, attrs);
}
