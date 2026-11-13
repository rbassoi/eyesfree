/**
 * Direction along which the user perceives "ghost" (doubled / overlapping) letters.
 *
 * Angles follow the protractor convention on the screen: measured counter-clockwise
 * from the horizontal.
 *
 * - `none`        — no ghosting perceived
 * - `horizontal`  — ghost displaced sideways (0°)
 * - `vertical`    — ghost displaced up/down (90°)
 * - `diagonal45`  — ghost displaced along the ↗ / ↙ line (45°)
 * - `diagonal135` — ghost displaced along the ↖ / ↘ line (135°)
 * - `outline`     — ghosting in every direction (radial); uses an all-round halo
 */
export type GhostAxis = 'none' | 'horizontal' | 'vertical' | 'diagonal45' | 'diagonal135' | 'outline';

/** Strength of the isotropic deconvolution (pre-sharpening) filter. */
export type SharpnessLevel = 'none' | 'mild' | 'medium' | 'strong';

/** Anti-crowding spacing level (0 = standard, 3 = wide). */
export type CrowdingLevel = 0 | 1 | 2 | 3;

/**
 * The user's perceptual vision profile. This is the ONLY thing that needs to be stored
 * or exchanged between platforms. Everything else is derived from it.
 *
 * It is intentionally free of medical data: it records *what the user chose*, not a
 * prescription.
 */
export interface VisionProfile {
  /** Schema version. */
  version: 1;
  /** Whether compensation should currently be applied. */
  enabled: boolean;
  /** Step 1 result — ghost-cancellation direction. */
  ghostAxis: GhostAxis;
  /** Step 2 result — deconvolution strength. */
  sharpness: SharpnessLevel;
  /** Anti-crowding letter/word spacing level. */
  crowding: CrowdingLevel;
  /** Global multiplier applied to every kernel and shadow strength. Range 0.25–2. Default 1. */
  intensity: number;
  /**
   * Compress the luminance range (white → light grey) so bright deconvolution halos have
   * real luminous headroom on the display. Strongly recommended. Default true.
   */
  surfaceCompensation: boolean;
  /** Text-size hint for hosts that support it (React Native, custom CSS). Range 1–2. Default 1. */
  fontScale: number;
  /** ISO-8601 timestamp of the last change (informational). */
  updatedAt?: string;
}

/** A row-major 3×3 convolution kernel. Weights always sum to 1 (brightness preserving). */
export interface ConvolutionKernel {
  order: 3;
  /** 9 weights, row-major (top-left → bottom-right). */
  matrix: number[];
}

/** A text shadow, in CSS pixels / density-independent points. */
export interface ShadowSpec {
  x: number;
  y: number;
  blur: number;
  /** RGBA tuple, channel values 0–255, alpha 0–1. */
  color: [number, number, number, number];
}

/** Linear tone mapping applied to R, G and B before convolution: `out = in * slope + intercept`. */
export interface ToneMapping {
  slope: number;
  intercept: number;
}

/** Suggested colours for hosts that prefer to restyle surfaces instead of tone-mapping. */
export interface SurfacePalette {
  background: string;
  surface: string;
  border: string;
  text: string;
}

/**
 * Platform-neutral description of *how* to render a profile. Every adapter (web, React
 * Native, Flutter, native) consumes this instead of re-implementing the rules.
 */
export interface RenderPlan {
  /** False when the profile is disabled — adapters should render normally. */
  active: boolean;
  /** Tone mapping to apply first (null = none). */
  tone: ToneMapping | null;
  /** Kernels to apply in order after tone mapping (may be empty). */
  kernels: ConvolutionKernel[];
  /** Text shadows (first = most important, for platforms that support only one). */
  shadows: ShadowSpec[];
  /** Ready-to-use CSS `text-shadow` value (`none` when empty). */
  textShadowCss: string;
  /** Extra letter spacing, in em. */
  letterSpacingEm: number;
  /** Extra word spacing, in em. */
  wordSpacingEm: number;
  /** Suggested font-weight increase (0–300) for platforms without GPU convolution. */
  fontWeightDelta: number;
  /** Font-size multiplier hint. */
  fontScale: number;
  /** Suggested palette when surface compensation is on (null otherwise). */
  surface: SurfacePalette | null;
}

/** Result of {@link validateProfile}. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
