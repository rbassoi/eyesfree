/**
 * Minimal build-time typings for the subset of `react-native` used by this package, so the
 * monorepo builds without installing React Native. Consumers get the real types from
 * their own `react-native` installation (the emitted .d.ts files only `import type` it).
 */
declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react';

  export type ColorValue = string;
  export interface TextStyle {
    color?: ColorValue;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | number;
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
    textShadowColor?: ColorValue;
    textShadowOffset?: { width: number; height: number };
    textShadowRadius?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    [key: string]: unknown;
  }
  export interface ViewStyle {
    backgroundColor?: ColorValue;
    borderColor?: ColorValue;
    [key: string]: unknown;
  }
  export type StyleProp<T> = T | RegisteredStyle<T> | ReadonlyArray<StyleProp<T>> | null | undefined | false;
  export type RegisteredStyle<T> = number & { __registeredStyleBrand: T };

  export interface AccessibilityState {
    checked?: boolean | 'mixed';
    selected?: boolean;
    disabled?: boolean;
  }
  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: ReactNode;
    accessibilityRole?: string;
    [key: string]: unknown;
  }
  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    [key: string]: unknown;
  }
  export interface PressableProps extends ViewProps {
    onPress?: () => void;
    accessibilityState?: AccessibilityState;
    accessibilityHint?: string;
  }
  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
  }

  export const Text: ComponentType<TextProps>;
  export const View: ComponentType<ViewProps>;
  export const Pressable: ComponentType<PressableProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const StyleSheet: {
    create<T extends Record<string, ViewStyle | TextStyle>>(styles: T): T;
    flatten<T>(style: StyleProp<T>): T;
  };
}
