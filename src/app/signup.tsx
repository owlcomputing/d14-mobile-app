import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import {
  EMAIL_CONSENT_TEXT,
  PUSH_CONSENT_TEXT,
  setPendingSignup,
} from '@/lib/prospect-signup';
import { useDivisions } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

/**
 * "Get race reminders": a guest creates a free account (no membership) with
 * an emailed 6-digit code. Verifying the code confirms their email. The
 * AuthProvider then creates their profile, preferences and consent records.
 */
export default function SignupScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { sendSignInCode, verifySignInCode } = useAuth();
  const divisions = useDivisions();

  const [step, setStep] = useState<'details' | 'code'>('details');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>([]); // empty = all divisions
  const [push, setPush] = useState(true);
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const toggleDivision = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const sendCode = async () => {
    if (busy) return;
    if (!firstName.trim()) return setError('Please enter your first name.');
    if (!EMAIL_RE.test(email.trim())) return setError('Please enter a valid email address.');
    setBusy(true);
    setError(null);
    setPendingSignup({
      email,
      firstName,
      lastName,
      divisions: selected.length ? selected : null,
      push,
      emailMarketing,
    });
    const { error } = await sendSignInCode(email, true);
    setBusy(false);
    if (error) return setError(error);
    setStep('code');
    setResendIn(RESEND_SECONDS);
  };

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await sendSignInCode(email, true);
    setBusy(false);
    if (error) return setError(error);
    setResendIn(RESEND_SECONDS);
  };

  const verify = async () => {
    if (busy || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    const { error } = await verifySignInCode(email, code);
    // On success the session arrives and this screen is replaced automatically.
    if (error) {
      setBusy(false);
      setError(error);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        style={styles.close}
        onPress={close}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close">
        <Ionicons name="close" size={26} color={c.textSecondary} />
      </Pressable>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'details' ? (
            <>
              <Ionicons name="notifications" size={34} color={c.red} />
              <Text style={styles.title}>Get race reminders</Text>
              <Text style={styles.subtitle}>
                Free, no membership needed. Hear about races, events and news from the divisions
                you follow.
              </Text>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>First name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoComplete="given-name"
                    textContentType="givenName"
                    placeholderTextColor={c.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    autoComplete="family-name"
                    textContentType="familyName"
                    placeholderTextColor={c.textTertiary}
                  />
                </View>
              </View>

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={c.textTertiary}
              />

              <Text style={styles.label}>Divisions you follow</Text>
              <Text style={styles.hint}>Leave all unselected to hear from every division.</Text>
              <View style={styles.chips}>
                {divisions.data?.map((d) =>
                  d.name ? (
                    <Pressable
                      key={d.id}
                      style={[styles.chip, selected.includes(d.name) && styles.chipActive]}
                      onPress={() => toggleDivision(d.name!)}>
                      <Text
                        style={[styles.chipText, selected.includes(d.name) && styles.chipTextActive]}>
                        {d.name}
                      </Text>
                    </Pressable>
                  ) : null,
                )}
              </View>

              <View style={styles.consent}>
                <Text style={styles.consentText}>{PUSH_CONSENT_TEXT}</Text>
                <Switch
                  value={push}
                  onValueChange={setPush}
                  trackColor={{ true: c.red, false: c.surfaceSelected }}
                  thumbColor={c.onAccent}
                  accessibilityLabel="Push notifications"
                />
              </View>
              <View style={styles.consent}>
                <Text style={styles.consentText}>{EMAIL_CONSENT_TEXT}</Text>
                <Switch
                  value={emailMarketing}
                  onValueChange={setEmailMarketing}
                  trackColor={{ true: c.red, false: c.surfaceSelected }}
                  thumbColor={c.onAccent}
                  accessibilityLabel="Email news and offers"
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton label="Email me a code" busy={busy} onPress={sendCode} />
              <Text style={styles.fine}>
                We&apos;ll email you a 6-digit code to confirm your address. You can change these
                choices or delete your account anytime in Profile.
              </Text>
              <Text style={styles.fine}>
                Want a full D14 membership? Create your free account here first, then tap
                &quot;Become a member&quot; to join in the app.
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="mail-unread" size={34} color={c.red} />
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code we sent to{'\n'}
                <Text style={{ color: c.text, fontWeight: '600' }}>{email.trim()}</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                onSubmitEditing={verify}
                placeholder="000000"
                placeholderTextColor={c.textTertiary}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Verify & Finish" busy={busy} onPress={verify} />
              <Pressable onPress={resend} disabled={resendIn > 0} style={styles.linkRow}>
                <Text style={[styles.link, resendIn > 0 && { color: c.textTertiary }]}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStep('details');
                  setCode('');
                  setError(null);
                }}
                style={styles.linkRow}>
                <Text style={styles.link}>Use a different email</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: c.redDark }]}
      onPress={onPress}
      disabled={busy}>
      {busy ? (
        <ActivityIndicator color={c.onAccent} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  close: { position: 'absolute', top: Spacing.five, right: Spacing.four, zIndex: 1 },
  content: { padding: Spacing.four, paddingTop: Spacing.five + Spacing.four },
  title: { color: c.text, fontSize: 26, fontWeight: '800', marginTop: Spacing.two },
  subtitle: {
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  row2: { flexDirection: 'row', gap: Spacing.two },
  label: {
    color: c.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  hint: { color: c.textTertiary, fontSize: 12, marginTop: -4, marginBottom: Spacing.two },
  input: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: c.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  codeInput: { fontSize: 28, letterSpacing: 10, textAlign: 'center', marginTop: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.red, borderColor: c.red },
  chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: c.onAccent },
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  consentText: { flex: 1, color: c.text, fontSize: 13, lineHeight: 18 },
  error: { color: c.error, marginTop: Spacing.three },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: Spacing.four,
  },
  buttonText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
  fine: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  linkRow: { alignItems: 'center', paddingVertical: Spacing.two, marginTop: Spacing.one },
  link: { color: c.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
}));
