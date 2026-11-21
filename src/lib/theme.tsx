import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';

import { darkPalette, lightPalette, type Palette } from '@/constants/theme';

/** What the user picked in Profile → Appearance. */
export type AppearancePreference = 'dark' | 'light' | 'system';
export type ColorScheme = 'dark' | 'light';

const STORAGE_KEY = 'd14.appearance';
/** New installs (and anyone who hasn't picked one) follow the phone's setting. */
const DEFAULT_PREFERENCE: AppearancePreference = 'system';

const PREFERENCES: readonly AppearancePreference[] = ['dark', 'light', 'system'];
const isPreference = (v: unknown): v is AppearancePreference =>
  PREFERENCES.includes(v as AppearancePreference);

/**
 * Make native UI (alerts, pickers, keyboard, date pickers) match the app:
 * forced light/dark, or 'unspecified' to follow the phone again.
 * react-native-web has no setColorScheme.
 */
function applyNativeScheme(preference: AppearancePreference) {
  if (typeof Appearance.setColorScheme !== 'function') return;
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

type ThemeState = {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
  /** The scheme in effect ('system' resolved against the phone setting) */
  scheme: ColorScheme;
  colors: Palette;
  /** The saved preference has been read; render UI only after this */
  ready: boolean;
};

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<AppearancePreference>(DEFAULT_PREFERENCE);
  const [ready, setReady] = useState(false);
  // Re-renders when the phone's setting changes; reflects setColorScheme
  // overrides too, so it's only read for 'system'.
  const systemScheme = useColorScheme();

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((stored) => {
        if (!alive) return;
        const pref = isPreference(stored) ? stored : DEFAULT_PREFERENCE;
        applyNativeScheme(pref);
        setPreferenceState(pref);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = useCallback((pref: AppearancePreference) => {
    applyNativeScheme(pref);
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;
  const colors = scheme === 'light' ? lightPalette : darkPalette;

  // Root view background (visible behind screen transitions / the keyboard)
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors]);

  const value = useMemo(
    () => ({ preference, setPreference, scheme, colors, ready }),
    [preference, setPreference, scheme, colors, ready],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeState(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useColors/useAppearance must be used inside ThemeProvider');
  return ctx;
}

/** The active color palette. */
export function useColors(): Palette {
  return useThemeState().colors;
}

/** The user's appearance preference, a setter, and the resolved scheme. */
export function useAppearance() {
  const { preference, setPreference, scheme, ready } = useThemeState();
  return { preference, setPreference, scheme, ready };
}

type NamedStyles = Parameters<typeof StyleSheet.create>[0];

/**
 * Palette-aware StyleSheet. Define styles once at module level:
 *
 *   const useStyles = makeStyles((c) => ({ title: { color: c.text } }));
 *
 * and call `const styles = useStyles()` in the component. The sheet is
 * created once per palette and cached.
 */
export function makeStyles<S extends NamedStyles>(factory: (c: Palette) => S & NamedStyles) {
  const cache = new WeakMap<Palette, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const colors = useColors();
    let sheet = cache.get(colors);
    if (!sheet) {
      sheet = StyleSheet.create(factory(colors));
      cache.set(colors, sheet);
    }
    return sheet;
  };
}
