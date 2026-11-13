import type { GhostAxis, SharpnessLevel } from '@eyesfree/core';

/** Every user-facing string of the calibrator. Provide a partial object to override. */
export interface CalibratorMessages {
  title: string;
  /** Template with `{current}` and `{total}`. */
  stepIndicator: string;
  /** Step 1 — viewing distance. */
  distanceInstruction: string;
  distanceGroupLabel: string;
  /** Template with `{distance}` (formatted, e.g. "1 m"). */
  distanceOption: string;
  /** Label for the 40 cm option (normal reading distance). */
  distanceNormal: string;
  distanceSampleText: string;
  /** Camera distance measurement (only shown when a distance monitor is attached). */
  measureWithCamera: string;
  stopCamera: string;
  measuring: string;
  /** Template with `{distance}`. */
  measuredDistance: string;
  cameraError: string;
  cameraPrivacy: string;
  /** Step 2 — text size. */
  sizeInstruction: string;
  /** Short sample shown at each candidate size. */
  sizeSample: string;
  /** Button that opens the optional fine-tuning steps. */
  moreAdjustments: string;
  sizeGroupLabel: string;
  /** Template with `{percent}`. */
  sizeOption: string;
  /** Step 2 — sharpness. */
  sharpnessInstruction: string;
  radiusLabel: string;
  radiusHint: string;
  /** Step 3 — doubled letters. */
  ghostInstruction: string;
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
  distanceInstruction:
    'Read this with your glasses on. Then take them off and move back from the screen until the big letters below look SHARP. About how far are you?',
  distanceGroupLabel: 'How far from the screen are you?',
  distanceOption: 'About {distance}',
  distanceNormal: 'Normal reading distance',
  distanceSampleText: 'Payment of $158.90',
  measureWithCamera: 'Measure with the camera',
  stopCamera: 'Turn off camera',
  measuring: 'Looking for your face…',
  measuredDistance: 'You are about {distance} from the screen',
  cameraError: 'The camera is not available. Choose the distance below.',
  cameraPrivacy: 'The image is analysed on this device only and never saved or sent.',
  sizeInstruction: 'From where you are now, tap the SMALLEST text you can read comfortably.',
  sizeSample: '$84.50 · 2 PM',
  moreAdjustments: 'More adjustments',
  sizeGroupLabel: 'Which is the smallest comfortable size?',
  sizeOption: 'Size {percent}%',
  sharpnessInstruction:
    'Move the slider until the sentences look sharpest, then tap the one that is easiest to read.',
  radiusLabel: 'Blur size',
  radiusHint: 'Small ← → Large',
  ghostInstruction: 'Do the letters look doubled? Tap the box where they look LEAST doubled (or "Standard" if none).',
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
    mild: { label: 'Level 1 · Mild', hint: 'Gentle sharpening' },
    medium: { label: 'Level 2 · Medium', hint: 'Balanced sharpening' },
    strong: { label: 'Level 3 · Strong', hint: 'Maximum sharpening' },
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
  distanceInstruction:
    'Leia isto de óculos. Depois tire os óculos e afaste-se da tela até as letras grandes abaixo ficarem NÍTIDAS. A que distância você está?',
  distanceGroupLabel: 'A que distância da tela você está?',
  distanceOption: 'Cerca de {distance}',
  distanceNormal: 'Distância normal de leitura',
  distanceSampleText: 'Pagamento de R$ 158,90',
  measureWithCamera: 'Medir com a câmera',
  stopCamera: 'Desligar câmera',
  measuring: 'Procurando seu rosto…',
  measuredDistance: 'Você está a cerca de {distance} da tela',
  cameraError: 'A câmera não está disponível. Escolha a distância abaixo.',
  cameraPrivacy: 'A imagem é analisada só neste aparelho; nunca é salva nem enviada.',
  sizeInstruction: 'De onde você está agora, toque no MENOR texto que consegue ler com conforto.',
  sizeSample: 'R$ 84,50 · 14h',
  moreAdjustments: 'Mais ajustes',
  sizeGroupLabel: 'Qual o menor tamanho confortável?',
  sizeOption: 'Tamanho {percent}%',
  sharpnessInstruction: 'Mova a régua até as frases ficarem mais nítidas e toque na que estiver mais fácil de ler.',
  radiusLabel: 'Tamanho do borrão',
  radiusHint: 'Pequeno ← → Grande',
  ghostInstruction: 'As letras parecem duplicadas? Toque no quadro onde parecem MENOS duplicadas (ou "Padrão" se não houver).',
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
    mild: { label: 'Nível 1 · Leve', hint: 'Realce suave' },
    medium: { label: 'Nível 2 · Médio', hint: 'Realce equilibrado' },
    strong: { label: 'Nível 3 · Forte', hint: 'Realce máximo' },
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
  distanceInstruction:
    'Lea esto con sus gafas puestas. Luego quíteselas y aléjese de la pantalla hasta que las letras grandes de abajo se vean NÍTIDAS. ¿A qué distancia está?',
  distanceGroupLabel: '¿A qué distancia de la pantalla está?',
  distanceOption: 'Unos {distance}',
  distanceNormal: 'Distancia normal de lectura',
  distanceSampleText: 'Pago de $158,90',
  measureWithCamera: 'Medir con la cámara',
  stopCamera: 'Apagar cámara',
  measuring: 'Buscando su rostro…',
  measuredDistance: 'Está a unos {distance} de la pantalla',
  cameraError: 'La cámara no está disponible. Elija la distancia abajo.',
  cameraPrivacy: 'La imagen se analiza solo en este dispositivo; nunca se guarda ni se envía.',
  sizeInstruction: 'Desde donde está ahora, toque el texto MÁS PEQUEÑO que puede leer con comodidad.',
  sizeSample: '$84,50 · 14 h',
  moreAdjustments: 'Más ajustes',
  sizeGroupLabel: '¿Cuál es el tamaño más pequeño cómodo?',
  sizeOption: 'Tamaño {percent}%',
  sharpnessInstruction: 'Mueva la barra hasta que las frases se vean más nítidas y toque la más fácil de leer.',
  radiusLabel: 'Tamaño del desenfoque',
  radiusHint: 'Pequeño ← → Grande',
  ghostInstruction: '¿Las letras se ven duplicadas? Toque el recuadro donde se vean MENOS duplicadas (o "Estándar" si no).',
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
    mild: { label: 'Nivel 1 · Leve', hint: 'Realce suave' },
    medium: { label: 'Nivel 2 · Medio', hint: 'Realce equilibrado' },
    strong: { label: 'Nivel 3 · Fuerte', hint: 'Realce máximo' },
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
