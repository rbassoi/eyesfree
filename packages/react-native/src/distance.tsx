import { createElement, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { distanceStatus } from '@eyesfree/core';
import type { DistanceStatus, FaceDistanceEstimator, FaceDistanceEstimatorOptions } from '@eyesfree/core';
import { StoreContextBridge } from './context.js';
import { createPhoneDistanceEstimator } from './distance-math.js';

export { createPhoneDistanceEstimator, measurementFromEyes } from './distance-math.js';

/** Stable estimator instance for a component. */
export function useDistanceEstimator(options?: FaceDistanceEstimatorOptions): FaceDistanceEstimator {
  const ref = useRef<FaceDistanceEstimator | null>(null);
  if (!ref.current) ref.current = createPhoneDistanceEstimator(options);
  return ref.current;
}

const noop = () => () => undefined;
const nil = () => null;

/**
 * Compares a measured distance with the profile's `viewingDistance`.
 * `status` is `idle` when there is no target or no measurement.
 */
export function useDistanceStatus(
  measuredCm: number | null | undefined,
  tolerance = 0.2,
): { status: DistanceStatus | 'idle'; targetCm: number } {
  const store = useContext(StoreContextBridge);
  const state = useSyncExternalStore(store ? store.subscribe : noop, store ? store.getState : nil, store ? store.getState : nil);
  const target = state?.plan.active ? (state.profile?.viewingDistance ?? 0) : 0;
  return useMemo(() => {
    if (!target || measuredCm === null || measuredCm === undefined) return { status: 'idle' as const, targetCm: target };
    return { status: distanceStatus(measuredCm, target, tolerance), targetCm: target };
  }, [measuredCm, target, tolerance]);
}

export interface EyesFreeDistanceHintProps {
  measuredCm: number | null | undefined;
  tolerance?: number;
  messages?: { tooClose?: string; tooFar?: string };
  style?: StyleProp<TextStyle>;
}

const fmt = (cm: number) => (cm < 100 ? `${Math.round(cm / 5) * 5} cm` : `${Math.round(cm / 10) / 10} m`);

/** Large banner shown only when the user is too close (or much too far). */
export function EyesFreeDistanceHint({ measuredCm, tolerance, messages, style }: EyesFreeDistanceHintProps) {
  const { status, targetCm } = useDistanceStatus(measuredCm, tolerance);
  if (status !== 'too-close' && status !== 'too-far') return null;
  const text =
    status === 'too-close'
      ? (messages?.tooClose ?? 'Move the phone a little farther: about {measured} now, best {target}.')
      : (messages?.tooFar ?? 'You can bring the phone a little closer (about {target}).');
  return createElement(
    Text,
    { accessibilityRole: 'alert', accessibilityLiveRegion: 'polite', style: [styles.hint, status === 'too-close' ? styles.close : null, style] },
    text.replace('{measured}', fmt(measuredCm ?? 0)).replace('{target}', fmt(targetCm)),
  );
}

const styles = StyleSheet.create({
  hint: { backgroundColor: '#0f172a', color: '#ffffff', fontSize: 20, fontWeight: '700', padding: 14, borderRadius: 16, overflow: 'hidden', textAlign: 'center' },
  close: { backgroundColor: '#b45309' },
});
