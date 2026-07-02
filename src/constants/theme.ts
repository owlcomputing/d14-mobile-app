import '@/global.css';

import { Platform } from 'react-native';

/**
 * D14 brand palette — dark-first. Black/charcoal surfaces, D14 red accent,
 * white text. Matches the district website and the 2011 logo set.
 */
export const D14Colors = {
  red: '#E63946',
  redDark: '#C1121F',
  black: '#0A0A0A',
  surface: '#161616',
  surfaceRaised: '#1F1F1F',
  surfaceSelected: '#2A2A2A',
  border: '#2E2E2E',
  white: '#FFFFFF',
  textSecondary: '#A5A9B0',
  textTertiary: '#6E7278',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#38BDF8',
} as const;

export const Colors = {
  light: {
    text: D14Colors.black,
    background: '#F4F4F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E4E4E7',
    textSecondary: '#60646C',
    tint: D14Colors.red,
  },
  dark: {
    text: D14Colors.white,
    background: D14Colors.black,
    backgroundElement: D14Colors.surface,
    backgroundSelected: D14Colors.surfaceSelected,
    textSecondary: D14Colors.textSecondary,
    tint: D14Colors.red,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
