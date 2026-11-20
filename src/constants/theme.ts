import '@/global.css';

import { Platform } from 'react-native';

/**
 * Semantic color roles. Components read the active palette with
 * `useColors()` / `makeStyles()` from `@/lib/theme`, so every color here
 * follows the user's Appearance setting (Dark / Light / Match phone).
 */
export type Palette = {
  /** Screen background */
  background: string;
  /** Cards, widgets, tab bar, headers */
  surface: string;
  /** Chips, icon tiles, inputs: one step up from `surface` */
  surfaceRaised: string;
  /** Selected / pressed fills, switch tracks */
  surfaceSelected: string;
  border: string;
  /** Primary text and icons on background / surfaces */
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** D14 brand red: accents, buttons, links */
  red: string;
  /** Pressed state of red buttons */
  redDark: string;
  /** Text / icons on red or other colored fills; white in both modes */
  onAccent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
};

/** Fixed brand values for code outside React (e.g. push notification channel color). */
export const BrandColors = {
  red: '#E63946',
} as const;

/** The original dark-first D14 look. Values must not change. */
export const darkPalette: Palette = {
  background: '#0A0A0A',
  surface: '#161616',
  surfaceRaised: '#1F1F1F',
  surfaceSelected: '#2A2A2A',
  border: '#2E2E2E',
  text: '#FFFFFF',
  textSecondary: '#A5A9B0',
  textTertiary: '#6E7278',
  red: BrandColors.red,
  redDark: '#C1121F',
  onAccent: '#FFFFFF',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#38BDF8',
};

/**
 * Light look: light grey background, white cards, near-black text.
 * Contrast (WCAG): text 17:1, textSecondary 6.8:1, textTertiary 4.7:1 on the
 * background (higher on white surfaces); status colors are darker shades so
 * they read on white (all >= 4.5:1 on white). Brand red is unchanged (4.2:1 on
 * white, the same as white-on-red buttons in dark mode).
 */
export const lightPalette: Palette = {
  background: '#F4F4F5',
  surface: '#FFFFFF',
  surfaceRaised: '#F0F0F2',
  surfaceSelected: '#E4E4E7',
  border: '#E0E0E4',
  text: '#111113',
  textSecondary: '#52555C',
  textTertiary: '#696D74',
  red: BrandColors.red,
  redDark: '#C1121F',
  onAccent: '#FFFFFF',
  success: '#15803D',
  warning: '#B45309',
  error: '#C62828',
  info: '#0369A1',
};

/** `#RRGGBB` + alpha (0-1) → `rgba(r,g,b,a)`. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

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
