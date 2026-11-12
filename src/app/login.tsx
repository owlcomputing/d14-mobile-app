import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openMembershipSignup } from '@/components/sign-in-prompt';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, sendSignInCode, verifySignInCode } = useAuth();
  // Guests can browse without signing in, so this sheet is always dismissible.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 'password' (default), or sign in with an emailed code: 'code' (enter
  // email) then 'verify' (enter the 6 digits). Codes work for existing
  // accounts only; new people use "Get race reminders".
  const [mode, setMode] = useState<'password' | 'code' | 'verify'>('password');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = async (fn: () => Promise<{ error: string | null }>, onOk?: () => void) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const { error } = await fn();
    setSubmitting(false);
    if (error) setError(error);
    else onOk?.();
  };

  const onSubmit = () => {
    if (!email) return;
    if (mode === 'password') {
      if (password) void run(() => signIn(email, password));
    } else if (mode === 'code') {
      void run(
        () => sendSignInCode(email, false),
        () => setMode('verify'),
      );
    } else if (code.length === 6) {
      void run(() => verifySignInCode(email, code));
    }
  };

  const switchMode = (next: 'password' | 'code') => {
    setMode(next);
    setCode('');
    setError(null);
  };

  const buttonLabel =
    mode === 'password' ? 'Sign In' : mode === 'code' ? 'Email Me a Code' : 'Verify & Sign In';

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        style={styles.close}
        onPress={close}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close sign in">
        <Ionicons name="close" size={26} color={D14Colors.textSecondary} />
      </Pressable>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/d14-logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.tagline}>Rights. Riding. Racing.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              editable={mode !== 'verify'}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={D14Colors.textTertiary}
              onSubmitEditing={mode === 'code' ? onSubmit : undefined}
            />
            {mode === 'password' ? (
              <>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  placeholder="••••••••"
                  placeholderTextColor={D14Colors.textTertiary}
                  onSubmitEditing={onSubmit}
                />
              </>
            ) : null}
            {mode === 'verify' ? (
              <>
                <Text style={styles.label}>6-digit code from your email</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  placeholderTextColor={D14Colors.textTertiary}
                  onSubmitEditing={onSubmit}
                />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={onSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={D14Colors.white} />
              ) : (
                <Text style={styles.buttonText}>{buttonLabel}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => switchMode(mode === 'password' ? 'code' : 'password')}
              style={styles.guestLink}>
              <Text style={styles.modeLink}>
                {mode === 'password'
                  ? 'Email me a sign-in code instead'
                  : 'Use my password instead'}
              </Text>
            </Pressable>

            <Pressable onPress={() => router.replace('/signup')} style={styles.guestLink}>
              <Text style={styles.modeLink}>New to District 14? Get race reminders (free)</Text>
            </Pressable>
            <Pressable onPress={openMembershipSignup}>
              <Text style={styles.hint}>Or become a full member on the D14 website</Text>
            </Pressable>

            <Pressable onPress={close} style={styles.guestLink}>
              <Text style={styles.guestLinkText}>Continue browsing as a guest</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D14Colors.black },
  close: {
    position: 'absolute',
    top: Spacing.five,
    right: Spacing.four,
    zIndex: 1,
  },
  guestLink: { alignItems: 'center', paddingVertical: Spacing.two },
  guestLinkText: {
    color: D14Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modeLink: {
    color: D14Colors.red,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four },
  header: { alignItems: 'center', marginBottom: Spacing.five },
  logo: { width: 260, height: 91 },
  tagline: {
    color: D14Colors.textSecondary,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: Spacing.two,
  },
  form: { gap: Spacing.two },
  label: {
    color: D14Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  input: {
    backgroundColor: D14Colors.surface,
    borderColor: D14Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: D14Colors.white,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  error: { color: D14Colors.error, marginTop: Spacing.two },
  button: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: Spacing.four,
  },
  buttonPressed: { backgroundColor: D14Colors.redDark },
  buttonText: { color: D14Colors.white, fontSize: 16, fontWeight: '700' },
  hint: {
    color: D14Colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.three,
    lineHeight: 18,
  },
});
