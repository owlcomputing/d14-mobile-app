import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

const STORAGE_KEY = 'd14.app-lock-enabled';
/** Re-lock if the app was backgrounded longer than this */
const RELOCK_AFTER_MS = 60_000;

type AppLockState = {
  enabled: boolean;
  locked: boolean;
  biometricsAvailable: boolean;
  setEnabled: (on: boolean) => Promise<boolean>;
  unlock: () => Promise<void>;
};

const AppLockContext = createContext<AppLockState | undefined>(undefined);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [stored, hasHardware, isEnrolled] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      setBiometricsAvailable(hasHardware && isEnrolled);
      if (stored === 'true') {
        setEnabledState(true);
        setLocked(true);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && enabled && backgroundedAt.current) {
        if (Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock AMA District 14',
      cancelLabel: 'Cancel',
    });
    if (result.success) setLocked(false);
  }, []);

  const setEnabled = useCallback(async (on: boolean) => {
    if (on) {
      // Prove biometrics work before turning the lock on
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable App Lock',
      });
      if (!result.success) return false;
    }
    setEnabledState(on);
    await AsyncStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
    return true;
  }, []);

  const value = useMemo(
    () => ({ enabled, locked, biometricsAvailable, setEnabled, unlock }),
    [enabled, locked, biometricsAvailable, setEnabled, unlock],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
