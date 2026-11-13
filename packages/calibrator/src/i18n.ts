import type { GhostAxis, SharpnessLevel } from '@eyesfree/core';

/** Every user-facing string of the calibrator. Provide a partial object to override. */
export interface CalibratorMessages {
  title: string;
  /** Template with `{current}` and `{total}`. */
  stepIndicator: string;
  step1Instruction: string;
  step2Instruction: string;
  ghostGroupLabel: string;
  sharpnessGroupLabel: string;
  ghost: Record<GhostAxis, string>;
  sharpness: Record<SharpnessLevel, { label: string; hint: string }>;
  mostChosen: string;
  spacingLabel: string;
  spacingLevels: [string, string, string, string];
  sampleLetters: string;
  sampleWord: string;
  sampleText: string;
  next: string;
  back: string;
  apply: string;
  cancel: string;
}

export const en: CalibratorMessages = {
  title: 'Reading without glasses',
  stepIndicator: 'Step {current} of {total}',
  step1Instruction:
    'Take off your glasses, hold the screen at your usual distance and tap the box where the letters look LEAST doubled or overlapping.',
  step2Instruction: 'Now tap the sentence where the letters and numbers are easiest to read without squinting.',
  ghostGroupLabel: 'Which box looks least doubled?',
  sharpnessGroupLabel: 'Which sentence is easiest to read?',
  ghost: {
    none: 'Option 1 · Standard',
    horizontal: 'Option 2 · Sideways',
    vertical: 'Option 3 · Up & down',
    diagonal135: 'Option 4 · Diagonal A',
    diagonal45: 'Option 5 · Diagonal B',
    outline: 'Option 6 · Outline',
  },
  sharpness: {
    none: { label: 'No sharpening', hint: 'Text as it normally looks' },
    mild: { label: 'Level 1 · Mild', hint: 'About +1.00 to +1.50' },
    medium: { label: 'Level 2 · Medium', hint: 'About +1.75 to +2.25' },
    strong: { label: 'Level 3 · Strong', hint: '+2.50 or more' },
  },
  mostChosen: 'Most chosen',
  spacingLabel: 'Separate letters that look "stuck together"',
  spacingLevels: ['Standard', 'Soft', 'Medium', 'Wide'],
  sampleLetters: 'E A O',
  sampleWord: 'Reading 48',
  sampleText: 'Payment of $158.90 confirmed',
  next: 'Continue',
  back: 'Back',
  apply: 'Apply to the app',
  cancel: 'Cancel',
};

export const ptBR: CalibratorMessages = {
  title: 'Leitura sem óculos',
  stepIndicator: 'Passo {current} de {total}',
  step1Instruction:
    'Tire os óculos, segure a tela na distância de costume e toque no quadro onde as letras parecem MENOS duplicadas ou sobrepostas.',
  step2Instruction: 'Agora toque na frase em que letras e números estão mais fáceis de ler, sem precisar apertar os olhos.',
  ghostGroupLabel: 'Qual quadro parece menos duplicado?',
  sharpnessGroupLabel: 'Qual frase está mais fácil de ler?',
  ghost: {
    none: 'Opção 1 · Padrão',
    horizontal: 'Opção 2 · Lateral',
    vertical: 'Opção 3 · Vertical',
    diagonal135: 'Opção 4 · Diagonal A',
    diagonal45: 'Opção 5 · Diagonal B',
    outline: 'Opção 6 · Contorno',
  },
  sharpness: {
    none: { label: 'Sem nitidez extra', hint: 'Texto como aparece normalmente' },
    mild: { label: 'Nível 1 · Leve', hint: 'Cerca de +1,00 a +1,50' },
    medium: { label: 'Nível 2 · Médio', hint: 'Cerca de +1,75 a +2,25' },
    strong: { label: 'Nível 3 · Forte', hint: '+2,50 ou mais' },
  },
  mostChosen: 'Mais escolhido',
  spacingLabel: 'Separar letras que parecem "grudadas"',
  spacingLevels: ['Padrão', 'Suave', 'Médio', 'Amplo'],
  sampleLetters: 'E A O',
  sampleWord: 'Leitura 48',
  sampleText: 'Pagamento de R$ 158,90 confirmado',
  next: 'Continuar',
  back: 'Voltar',
  apply: 'Aplicar no aplicativo',
  cancel: 'Cancelar',
};

export const es: CalibratorMessages = {
  title: 'Leer sin gafas',
  stepIndicator: 'Paso {current} de {total}',
  step1Instruction:
    'Quítese las gafas, sostenga la pantalla a la distancia habitual y toque el recuadro donde las letras se vean MENOS duplicadas o superpuestas.',
  step2Instruction: 'Ahora toque la frase donde las letras y los números se lean con más facilidad, sin entrecerrar los ojos.',
  ghostGroupLabel: '¿Qué recuadro se ve menos duplicado?',
  sharpnessGroupLabel: '¿Qué frase es más fácil de leer?',
  ghost: {
    none: 'Opción 1 · Estándar',
    horizontal: 'Opción 2 · Lateral',
    vertical: 'Opción 3 · Vertical',
    diagonal135: 'Opción 4 · Diagonal A',
    diagonal45: 'Opción 5 · Diagonal B',
    outline: 'Opción 6 · Contorno',
  },
  sharpness: {
    none: { label: 'Sin nitidez extra', hint: 'Texto como se ve normalmente' },
    mild: { label: 'Nivel 1 · Leve', hint: 'Aprox. +1,00 a +1,50' },
    medium: { label: 'Nivel 2 · Medio', hint: 'Aprox. +1,75 a +2,25' },
    strong: { label: 'Nivel 3 · Fuerte', hint: '+2,50 o más' },
  },
  mostChosen: 'Más elegido',
  spacingLabel: 'Separar letras que parecen "pegadas"',
  spacingLevels: ['Estándar', 'Suave', 'Medio', 'Amplio'],
  sampleLetters: 'E A O',
  sampleWord: 'Lectura 48',
  sampleText: 'Pago de $158,90 confirmado',
  next: 'Continuar',
  back: 'Atrás',
  apply: 'Aplicar en la app',
  cancel: 'Cancelar',
};

/** Built-in locales. Add yours with {@link registerLocale}. */
export const LOCALES: Record<string, CalibratorMessages> = { en, 'pt-BR': ptBR, pt: ptBR, es };

/** Registers (or replaces) a locale, e.g. `registerLocale('fr', { ...en, title: 'Lire sans lunettes', … })`. */
export function registerLocale(tag: string, messages: CalibratorMessages): void {
  LOCALES[tag] = messages;
}

/** Resolves a BCP-47 tag (`pt-BR` → `pt-BR`, `pt-PT` → `pt`, `es-MX` → `es`, unknown → `en`). */
export function resolveLocale(tag?: string | null): CalibratorMessages {
  if (!tag) return en;
  if (LOCALES[tag]) return LOCALES[tag]!;
  const base = tag.split('-')[0]!.toLowerCase();
  return LOCALES[base] ?? en;
}

/** Deep-merges overrides into a base message set. */
export function mergeMessages(base: CalibratorMessages, overrides?: Partial<CalibratorMessages> | null): CalibratorMessages {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    ghost: { ...base.ghost, ...(overrides.ghost ?? {}) },
    sharpness: { ...base.sharpness, ...(overrides.sharpness ?? {}) },
  };
}

export function formatStep(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total));
}
