import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';

const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://ama-d14.org';

/** Opens the website's membership signup page in an in-app browser. */
export function openMembershipSignup() {
  return WebBrowser.openBrowserAsync(`${WEBSITE_URL}/membership`);
}

type SignInPromptProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  /**
   * 'guest' (signed out): Sign In + Become a Member.
   * 'prospect' (signed in, no membership): Become a Member only.
   */
  variant?: 'guest' | 'prospect';
};

/**
 * Shown in place of member-only content: to guests with a way to sign in and
 * a way to join, and to prospects with a way to join.
 */
export function SignInPrompt({ icon, title, message, variant = 'guest' }: SignInPromptProps) {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  return (
    <Widget style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={c.red} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {variant === 'guest' ? (
        <>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && { backgroundColor: c.redDark }]}
            onPress={() => router.push('/login')}>
            <Text style={styles.primaryText}>Sign In</Text>
          </Pressable>
          {/* Joining needs an account first: free sign-up, then "Become a member" in the app */}
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/signup')}>
            <Text style={styles.secondaryText}>Become a Member</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && { backgroundColor: c.redDark }]}
          onPress={() => router.push('/join')}>
          <Text style={styles.primaryText}>Become a Member</Text>
        </Pressable>
      )}
    </Widget>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: { color: c.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  secondary: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: Spacing.two,
  },
  secondaryText: { color: c.text, fontSize: 14, fontWeight: '600' },
}));
