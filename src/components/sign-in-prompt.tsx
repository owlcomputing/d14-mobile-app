import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';

const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://ama-d14.org';

/** Opens the website's membership signup page in an in-app browser. */
export function openMembershipSignup() {
  return WebBrowser.openBrowserAsync(`${WEBSITE_URL}/membership`);
}

type SignInPromptProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
};

/**
 * Shown to guests (signed-out users) in place of member-only content, with
 * a way to sign in and a way to join.
 */
export function SignInPrompt({ icon, title, message }: SignInPromptProps) {
  const router = useRouter();
  return (
    <Widget style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={D14Colors.red} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        style={({ pressed }) => [styles.primary, pressed && { backgroundColor: D14Colors.redDark }]}
        onPress={() => router.push('/login')}>
        <Text style={styles.primaryText}>Sign In</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
        onPress={openMembershipSignup}>
        <Text style={styles.secondaryText}>Become a Member</Text>
      </Pressable>
    </Widget>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: D14Colors.surface,
    borderWidth: 1,
    borderColor: D14Colors.border,
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: D14Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: { color: D14Colors.white, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: {
    color: D14Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: { color: D14Colors.white, fontSize: 15, fontWeight: '700' },
  secondary: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: D14Colors.border,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: Spacing.two,
  },
  secondaryText: { color: D14Colors.white, fontSize: 14, fontWeight: '600' },
});
