import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useAppLock } from '@/providers/app-lock-provider';

export function LockScreen() {
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
        <Ionicons name="lock-open" size={18} color={D14Colors.white} />
        <Text style={styles.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: D14Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  logo: { width: 220, height: 77 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.five,
    paddingVertical: 14,
  },
  buttonText: { color: D14Colors.white, fontSize: 15, fontWeight: '700' },
});
