import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

import { Chips, Field, formatDateInput, parseBirthdate } from '@/components/form-fields';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { addFamilyMember } from '@/lib/family';
import { useDivisions } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

/**
 * Add a family member to the account and pay for their membership (one year).
 * Same as the website's "Add a New Family Member".
 */
export default function AddFamilyMemberScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const divisions = useDivisions();
  const disciplineOptions = useMemo(
    () => divisions.data?.map((d) => d.name).filter((n): n is string => !!n) ?? [],
    [divisions.data],
  );

  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [suffix, setSuffix] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [amaNumber, setAmaNumber] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);

  const pay = async () => {
    if (!profile || working) return;
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Required';
    if (!lastName.trim()) e.lastName = 'Required';
    const iso = parseBirthdate(birthdate);
    if (!iso) e.birthdate = 'Enter a valid date as MM/DD/YYYY';
    setErrors(e);
    if (Object.keys(e).length || !iso) return;

    try {
      const outcome = await addFamilyMember(
        profile,
        {
          firstName,
          middleInitial,
          lastName,
          suffix,
          birthdate: iso,
          amaNumber,
          disciplines,
        },
        setWorking,
      );
      await queryClient.invalidateQueries({ queryKey: ['family'] });
      if (outcome === 'paid') {
        Alert.alert(
          'Family member added',
          `${firstName.trim()}'s membership is active. Their card is in your Wallet.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else if (outcome === 'processing') {
        Alert.alert(
          'Payment processing',
          `Your payment is still processing. ${firstName.trim()} will appear in your family once it completes.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Checkout not completed', 'No payment was made. You can try again anytime.');
      }
    } catch (err) {
      Alert.alert('Could not add family member', err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          They get their own one-year D14 membership and card, managed by you. They share your
          address and phone number.
        </Text>

        <Widget>
          <View style={styles.row}>
            <Field
              label="First name"
              required
              value={firstName}
              onChangeText={setFirstName}
              error={errors.firstName}
              style={{ flex: 3 }}
            />
            <Field
              label="M.I."
              value={middleInitial}
              onChangeText={(t) => setMiddleInitial(t.slice(0, 1).toUpperCase())}
              style={{ flex: 1 }}
            />
          </View>
          <View style={styles.row}>
            <Field
              label="Last name"
              required
              value={lastName}
              onChangeText={setLastName}
              error={errors.lastName}
              style={{ flex: 3 }}
            />
            <Field label="Suffix" value={suffix} onChangeText={setSuffix} style={{ flex: 1 }} />
          </View>
          <View style={styles.row}>
            <Field
              label="Birthdate"
              required
              value={birthdate}
              onChangeText={(t) => setBirthdate(formatDateInput(t))}
              placeholder="MM/DD/YYYY"
              keyboardType="number-pad"
              error={errors.birthdate}
              style={{ flex: 1 }}
            />
            <Field
              label="AMA number"
              value={amaNumber}
              onChangeText={setAmaNumber}
              keyboardType="number-pad"
              placeholder="If they have one"
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ marginTop: Spacing.three }}>
            <Text style={styles.fieldLabel}>Disciplines</Text>
            <Chips
              options={disciplineOptions}
              selected={disciplines}
              onToggle={(d) =>
                setDisciplines((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))
              }
            />
          </View>
        </Widget>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { backgroundColor: c.redDark }]}
          onPress={pay}
          disabled={!!working}>
          {working ? (
            <View style={styles.workingRow}>
              <ActivityIndicator color={c.onAccent} />
              <Text style={styles.buttonText}>{working}</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Continue to Payment</Text>
          )}
        </Pressable>
        <Text style={styles.note}>
          Payment is processed securely by Stripe. You&apos;ll come back to the app when finished.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  intro: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  fieldLabel: {
    color: c.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.two,
  },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  workingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  note: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.three,
    textAlign: 'center',
  },
}));
