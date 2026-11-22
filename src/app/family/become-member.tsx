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

import { Chips, Field } from '@/components/form-fields';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { becomeMemberYourself } from '@/lib/family';
import { useDivisions } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

/**
 * A family-only account holder (pays for family members, no membership of
 * their own) gets a membership for themselves. Website: "Become a full member".
 */
export default function BecomeMemberScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, isFamilyHolder, refreshProfile } = useAuth();
  const divisions = useDivisions();
  const disciplineOptions = useMemo(
    () => divisions.data?.map((d) => d.name).filter((n): n is string => !!n) ?? [],
    [divisions.data],
  );
  const [amaNumber, setAmaNumber] = useState(profile?.ama_number ?? '');
  const [disciplines, setDisciplines] = useState<string[]>(profile?.disciplines ?? []);
  const [working, setWorking] = useState<string | null>(null);

  const pay = async () => {
    if (!profile || working) return;
    try {
      const outcome = await becomeMemberYourself(profile, { amaNumber, disciplines }, setWorking);
      if (outcome === 'paid') {
        await refreshProfile();
        await queryClient.invalidateQueries({ queryKey: ['family'] });
        Alert.alert(
          "You're a member!",
          'Your membership is active and your card is in the Wallet. You still manage your family.',
          [{ text: 'Open Wallet', onPress: () => router.dismissTo('/wallet') }],
        );
      } else if (outcome === 'processing') {
        Alert.alert(
          'Payment processing',
          'Your payment is still processing. Your membership will activate automatically once it completes.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Checkout not completed', 'No payment was made. You can try again anytime.');
      }
    } catch (err) {
      Alert.alert('Could not start checkout', err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(null);
    }
  };

  if (!isFamilyHolder) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.intro}>You already have a membership of your own.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Get a one-year D14 membership and card for yourself. You&apos;ll still manage your family
          members&apos; memberships.
        </Text>

        <Widget>
          <Field
            label="Your AMA number"
            value={amaNumber}
            onChangeText={setAmaNumber}
            keyboardType="number-pad"
            placeholder="On your AMA card or in your AMA account"
          />
          <View style={{ marginTop: Spacing.three }}>
            <Text style={styles.fieldLabel}>Disciplines you ride</Text>
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  intro: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
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
