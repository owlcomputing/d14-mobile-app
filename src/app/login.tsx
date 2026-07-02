import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={D14Colors.textTertiary}
          />
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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={onSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={D14Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              WebBrowser.openBrowserAsync(
                process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://ama-d14.org',
              )
            }>
            <Text style={styles.hint}>
              New to District 14? Tap here to sign up for a membership on the D14 website — in-app
              signup is coming soon.
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D14Colors.black },
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four },
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
