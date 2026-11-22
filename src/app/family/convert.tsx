import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Field } from '@/components/form-fields';
import { Widget } from '@/components/widget';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { convertFamilyMember, PartialConversionError } from '@/lib/family';
import { useFamilyMembers } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/**
 * Give a family member their own login (website: "Convert to non-linked
 * account"). Their membership moves to the new account; the holder no
 * longer manages them.
 */
export default function ConvertFamilyMemberScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const family = useFamilyMembers(profile?.id);
  const member = family.data?.find((f) => f.id === id);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);

  if (!member || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        {family.isPending ? <ActivityIndicator color={c.red} /> : null}
      </View>
    );
  }
  const firstName = member.first_name || 'They';
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ');

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: ['family'] });
    router.dismissTo('/family');
  };

  const convert = async () => {
    const e: Record<string, string> = {};
    if (!EMAIL.test(email.trim())) e.email = 'Enter a valid email address';
    else if (email.trim().toLowerCase() === profile.email?.toLowerCase())
      e.email = 'Use their own email, not yours';
    if (password.length < MIN_PASSWORD) e.password = `At least ${MIN_PASSWORD} characters`;
    if (confirm !== password) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length || working) return;

    setWorking(true);
    try {
      await convertFamilyMember(profile, member, { email, password });
      Alert.alert(
        'Login created',
        `${name} can now sign in to the app or website with ${email.trim().toLowerCase()} and the password you set. Their membership moved to their new account.`,
        [{ text: 'OK', onPress: () => void finish() }],
      );
    } catch (err) {
      if (err instanceof PartialConversionError) {
        Alert.alert('Almost done', err.message, [{ text: 'OK', onPress: () => void finish() }]);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(
          'Could not create login',
          /already (been )?registered|already exists/i.test(message)
            ? 'That email already has a D14 account. Use a different email address.'
            : `${message}\n\nNothing was changed; ${firstName} is still on your account.`,
        );
      }
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Give {firstName} their own login</Text>
        <Text style={styles.intro}>
          {name} gets their own D14 account to sign in to the app and website, with their own card.
          Their membership and expiration date move with them.
        </Text>

        <View style={styles.warning}>
          <Ionicons name="warning" size={18} color={c.warning} />
          <Text style={styles.warningText}>
            This can&apos;t be undone. {firstName} will no longer be on your account: you won&apos;t
            see their card or renew their membership.
          </Text>
        </View>

        <Widget header={`${firstName}'s new login`}>
          <Field
            label="Email"
            required
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            error={errors.email}
          />
          <Field
            label="Password"
            required
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            error={errors.password}
          />
          <Field
            label="Confirm password"
            required
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            error={errors.confirm}
          />
          <Text style={styles.hint}>
            Give them the password, or they can sign in with an emailed code instead.
          </Text>
        </Widget>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { backgroundColor: c.redDark }]}
          onPress={convert}
          disabled={working}>
          {working ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Create {firstName}&apos;s Login</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  title: { color: c.text, fontSize: 20, fontWeight: '800' },
  intro: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  warning: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: withAlpha(c.warning, 0.12),
    borderColor: withAlpha(c.warning, 0.4),
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  warningText: { color: c.text, fontSize: 13, lineHeight: 19, flex: 1 },
  hint: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.two,
  },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.two,
  },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
}));
