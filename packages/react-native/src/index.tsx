/**
 * @eyesfree/react-native — EyesFree for React Native and Expo.
 *
 * ```tsx
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 *
 * <EyesFreeProvider storage={AsyncStorage}>
 *   <EyesFreeSurface style={{ flex: 1 }}>
 *     <EyesFreeText style={{ fontSize: 18 }}>Balance: $3,482.65</EyesFreeText>
 *   </EyesFreeSurface>
 * </EyesFreeProvider>
 * ```
 *
 * Original project: https://github.com/rbassoi/eyesfree — Apache-2.0
 */
import { createElement, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextProps, TextStyle, ViewProps, ViewStyle } from 'react-native';
import type { RenderPlan, VisionProfile } from '@eyesfree/core';
import { StoreContextBridge } from './context.js';
import { EyesFreeNativeStore } from './store.js';
import type { AsyncStorageLike, NativeState } from './store.js';
import { nativeSurfaceStyle, nativeTextStyle } from './style.js';
import type { NativeTextStyleOptions } from './style.js';

export { EyesFreeNativeStore } from './store.js';
export type { AsyncStorageLike, NativeState } from './store.js';
export { boostFontWeight, nativeSurfaceStyle, nativeTextStyle } from './style.js';
export type { NativeTextStyleOptions } from './style.js';
export { EyesFreeCalibrator } from './calibrator.js';
export type { EyesFreeCalibratorProps, NativeCalibratorMessages } from './calibrator.js';
export type { RenderPlan, VisionProfile } from '@eyesfree/core';

const StoreContext = StoreContextBridge;

export interface EyesFreeProviderProps {
  children?: ReactNode;
  /** AsyncStorage-compatible persistence (omit for in-memory). */
  storage?: AsyncStorageLike;
  storageKey?: string;
  /** Profile used when nothing is stored yet (object, JSON or `EF1.` code — e.g. from a deep link). */
  initialProfile?: Partial<VisionProfile> | string | null;
  /** Bring your own store (e.g. to share it with non-React code). */
  store?: EyesFreeNativeStore;
  onError?: (error: unknown) => void;
}

export function EyesFreeProvider({ children, storage, storageKey, initialProfile, store, onError }: EyesFreeProviderProps) {
  const [instance] = useState(() => store ?? new EyesFreeNativeStore(storage ?? null, storageKey, onError));
  useEffect(() => {
    void instance.init(initialProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);
  return createElement(StoreContext.Provider, { value: instance }, children);
}

function useStore(): EyesFreeNativeStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('[eyesfree] useEyesFree must be used inside <EyesFreeProvider>');
  return s;
}

export interface UseEyesFreeResult extends NativeState {
  store: EyesFreeNativeStore;
  active: boolean;
  apply: (p: Partial<VisionProfile>) => VisionProfile;
  update: (p: Partial<VisionProfile>) => VisionProfile;
  enable: () => VisionProfile;
  disable: () => VisionProfile | null;
  toggle: () => VisionProfile | null;
  reset: () => void;
  shareCode: string | null;
}

export function useEyesFree(): UseEyesFreeResult {
  const store = useStore();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return useMemo(
    () => ({
      ...state,
      store,
      active: state.plan.active,
      apply: (p: Partial<VisionProfile>) => store.apply(p),
      update: (p: Partial<VisionProfile>) => store.update(p),
      enable: () => store.enable(),
      disable: () => store.disable(),
      toggle: () => store.toggle(),
      reset: () => store.reset(),
      shareCode: store.getShareCode(),
    }),
    [store, state],
  );
}

/** Render plan from context, or the inactive plan when no provider is present. */
export function useEyesFreePlan(): RenderPlan | null {
  const store = useContext(StoreContext);
  const state = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getState : nullState,
    store ? store.getState : nullState,
  );
  return state ? state.plan : null;
}
const noopSubscribe = () => () => undefined;
const nullState = () => null;

/** Text style for the current profile, merged over `base`. */
export function useEyesFreeTextStyle(base?: StyleProp<TextStyle>, options?: Omit<NativeTextStyleOptions, 'fontSize' | 'fontWeight'>): TextStyle {
  const plan = useEyesFreePlan();
  return useMemo(() => {
    const flat = (StyleSheet.flatten(base) ?? {}) as TextStyle;
    if (!plan) return flat;
    return { ...flat, ...nativeTextStyle(plan, { ...options, fontSize: flat.fontSize ?? 14, fontWeight: flat.fontWeight }) };
  }, [plan, base, options]);
}

export interface EyesFreeTextProps extends TextProps {
  /** Skip compensation for this text (icons, logos…). */
  eyesfreeIgnore?: boolean;
}

/** Drop-in replacement for `<Text>` that applies the user's profile. */
export function EyesFreeText({ style, eyesfreeIgnore, ...rest }: EyesFreeTextProps) {
  const compensated = useEyesFreeTextStyle(style);
  return createElement(Text, { ...rest, style: eyesfreeIgnore ? style : compensated });
}

export interface EyesFreeSurfaceProps extends ViewProps {
  /** `background` for screens, `surface` for cards. Default `background`. */
  kind?: 'background' | 'surface';
}

/** `<View>` that switches to the low-glare palette when compensation is active. */
export function EyesFreeSurface({ style, kind = 'background', ...rest }: EyesFreeSurfaceProps) {
  const plan = useEyesFreePlan();
  const extra: ViewStyle = plan ? nativeSurfaceStyle(plan, kind) : {};
  return createElement(View, { ...rest, style: [style, extra] });
}
export {
  createPhoneDistanceEstimator,
  EyesFreeDistanceHint,
  measurementFromEyes,
  useDistanceEstimator,
  useDistanceStatus,
} from './distance.js';
export type { EyesFreeDistanceHintProps } from './distance.js';
