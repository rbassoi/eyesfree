import { createElement, useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { createRenderPlan, DEFAULT_PROFILE, normalizeProfile } from '@eyesfree/core';
import type { CrowdingLevel, GhostAxis, SharpnessLevel, VisionProfile } from '@eyesfree/core';
import { nativeTextStyle } from './style.js';
import type { EyesFreeNativeStore } from './store.js';
import { StoreContextBridge } from './context.js';

const GHOST: GhostAxis[] = ['none', 'horizontal', 'vertical', 'diagonal135', 'diagonal45', 'outline'];
const SHARP: SharpnessLevel[] = ['none', 'mild', 'medium', 'strong'];

export interface NativeCalibratorMessages {
  title: string;
  stepIndicator: string;
  step1Instruction: string;
  step2Instruction: string;
  ghost: Record<GhostAxis, string>;
  sharpness: Record<SharpnessLevel, string>;
  spacingLabel: string;
  spacingLevels: [string, string, string, string];
  sampleLetters: string;
  sampleText: string;
  next: string;
  back: string;
  apply: string;
  cancel: string;
}

const EN: NativeCalibratorMessages = {
  title: 'Reading without glasses',
  stepIndicator: 'Step {current} of {total}',
  step1Instruction: 'Take off your glasses and tap the box where the letters look LEAST doubled or overlapping.',
  step2Instruction: 'Now tap the sentence that is easiest to read without squinting.',
  ghost: {
    none: 'Option 1 · Standard',
    horizontal: 'Option 2 · Sideways',
    vertical: 'Option 3 · Up & down',
    diagonal135: 'Option 4 · Diagonal A',
    diagonal45: 'Option 5 · Diagonal B',
    outline: 'Option 6 · Outline',
  },
  sharpness: { none: 'No sharpening', mild: 'Level 1 · Mild', medium: 'Level 2 · Medium', strong: 'Level 3 · Strong' },
  spacingLabel: 'Separate letters that look "stuck together"',
  spacingLevels: ['Standard', 'Soft', 'Medium', 'Wide'],
  sampleLetters: 'E A O',
  sampleText: 'Payment of $158.90 confirmed',
  next: 'Continue →',
  back: '← Back',
  apply: 'Apply ✓',
  cancel: 'Cancel',
};

export interface EyesFreeCalibratorProps {
  messages?: Partial<NativeCalibratorMessages>;
  /** Apply through the provider's store on completion. Default true. */
  autoApply?: boolean;
  initialProfile?: Partial<VisionProfile>;
  onComplete?: (profile: VisionProfile) => void;
  onCancel?: () => void;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
}

/**
 * React Native calibration wizard.
 *
 * Note: React Native has no built-in convolution filter, so previews here use the
 * shadow, spacing and weight approximations. For pixel-accurate deconvolution use
 * `@shopify/react-native-skia` with the plan's kernels (see docs/integrations/react-native.md).
 */
export function EyesFreeCalibrator(props: EyesFreeCalibratorProps) {
  const store = useContext(StoreContextBridge);
  const m = { ...EN, ...(props.messages ?? {}) };
  const accent = props.accentColor ?? '#1d4ed8';
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<VisionProfile>(() =>
    normalizeProfile({ ...DEFAULT_PROFILE, ...(store?.getState().profile ?? {}), ...(props.initialProfile ?? {}), enabled: true }),
  );
  const patch = (p: Partial<VisionProfile>) => setDraft((d) => normalizeProfile({ ...d, ...p, enabled: true }));

  const finish = () => {
    const profile = { ...draft, updatedAt: new Date().toISOString() };
    if (store && props.autoApply !== false) store.apply(profile);
    props.onComplete?.(profile);
  };

  const cards = useMemo(() => {
    if (step === 1) {
      return GHOST.map((axis) => {
        const plan = createRenderPlan({ ...draft, ghostAxis: axis, sharpness: 'none', crowding: 0 });
        const checked = draft.ghostAxis === axis;
        return card(`g-${axis}`, checked, accent, () => patch({ ghostAxis: axis }), m.ghost[axis], [
          createElement(Text, { key: 's', style: [styles.letters, nativeTextStyle(plan, { fontSize: 30, fontWeight: '800' })] }, m.sampleLetters),
        ], styles.gridCard);
      });
    }
    return SHARP.map((level) => {
      const plan = createRenderPlan({ ...draft, sharpness: level });
      const checked = draft.sharpness === level;
      return card(`s-${level}`, checked, accent, () => patch({ sharpness: level }), m.sharpness[level], [
        createElement(Text, { key: 's', style: [styles.sentence, nativeTextStyle(plan, { fontSize: 18, fontWeight: '600' })] }, m.sampleText),
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft, accent, m.sampleLetters, m.sampleText]);

  const header = createElement(
    View,
    { style: styles.panel },
    createElement(
      View,
      { style: styles.headRow },
      createElement(Text, { style: [styles.title, { color: accent }] }, m.title),
      createElement(
        Text,
        { style: [styles.badge, { backgroundColor: accent }], accessibilityLiveRegion: 'polite' },
        m.stepIndicator.replace('{current}', String(step)).replace('{total}', '2'),
      ),
    ),
    createElement(Text, { style: styles.instruction }, step === 1 ? m.step1Instruction : m.step2Instruction),
  );

  const spacing =
    step === 2
      ? createElement(
          View,
          { key: 'spacing', style: styles.spacingBox },
          createElement(Text, { style: styles.spacingLabel }, `${m.spacingLabel}: ${m.spacingLevels[draft.crowding]}`),
          createElement(
            View,
            { style: styles.segmented, accessibilityRole: 'radiogroup' },
            ...([0, 1, 2, 3] as CrowdingLevel[]).map((lvl) =>
              createElement(
                Pressable,
                {
                  key: lvl,
                  onPress: () => patch({ crowding: lvl }),
                  accessibilityRole: 'radio',
                  accessibilityState: { checked: draft.crowding === lvl },
                  accessibilityLabel: m.spacingLevels[lvl],
                  style: [styles.segment, draft.crowding === lvl ? { backgroundColor: accent, borderColor: accent } : null],
                },
                createElement(Text, { style: [styles.segmentText, draft.crowding === lvl ? { color: '#fff' } : null] }, m.spacingLevels[lvl]),
              ),
            ),
          ),
        )
      : null;

  const actions = createElement(
    View,
    { style: styles.actions },
    createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        onPress: step === 1 ? () => props.onCancel?.() : () => setStep(1),
        style: [styles.btn, styles.btnSecondary],
      },
      createElement(Text, { style: styles.btnSecondaryText }, step === 1 ? m.cancel : m.back),
    ),
    createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        onPress: step === 1 ? () => setStep(2) : finish,
        style: [styles.btn, styles.btnPrimary, { backgroundColor: step === 1 ? accent : '#047857' }],
      },
      createElement(Text, { style: styles.btnPrimaryText }, step === 1 ? m.next : m.apply),
    ),
  );

  return createElement(
    ScrollView,
    { style: props.style, contentContainerStyle: styles.container },
    header,
    createElement(View, { style: step === 1 ? styles.grid : styles.list, accessibilityRole: 'radiogroup' }, ...cards),
    spacing,
    actions,
  );
}

function card(
  key: string,
  checked: boolean,
  accent: string,
  onPress: () => void,
  label: string,
  children: unknown[],
  extra?: ViewStyle,
) {
  return createElement(
    Pressable,
    {
      key,
      onPress,
      accessibilityRole: 'radio',
      accessibilityState: { checked },
      accessibilityLabel: label,
      style: [styles.card, extra, checked ? { borderColor: accent, borderWidth: 3 } : null],
    },
    createElement(Text, { style: styles.cardLabel }, label),
    ...(children as never[]),
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  panel: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 2, borderRadius: 18, padding: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  badge: { color: '#fff', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  instruction: { fontSize: 17, lineHeight: 24, color: '#0f172a', fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  list: { gap: 10 },
  card: { backgroundColor: '#e4e7ec', borderColor: '#cbd5e1', borderWidth: 2, borderRadius: 18, padding: 14, minHeight: 56 },
  gridCard: { flexBasis: '46%', flexGrow: 1, alignItems: 'center' },
  cardLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  letters: { fontSize: 30, fontWeight: '800', color: '#0f172a' },
  sentence: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  spacingBox: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 18, padding: 12, gap: 8 },
  spacingLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  segmented: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnSecondary: { flex: 1, borderWidth: 2, borderColor: '#94a3b8' },
  btnPrimary: { flex: 2 },
  btnSecondaryText: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

export type { EyesFreeNativeStore };
