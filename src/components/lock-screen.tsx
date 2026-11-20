import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useAppLock } from '@/providers/app-lock-provider';

export function LockScreen() {
  const c = useColors();
  const styles = useStyles();
  const { unlock } = useAppLock();

  // Prompt immediately when the lock screen appears
  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/d14-logo.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <Pressable style={styles.button} onPress={unlock}>
        <Ionicons name="lock-open" size={18} color={c.onAccent} />
        <Text style={styles.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  logo: { width: 220, height: 77 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: c.red,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.five,
    paddingVertical: 14,
  },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
}));
