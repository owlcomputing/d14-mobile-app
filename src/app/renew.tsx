import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useFamilyMembers } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const CHECKOUT_RETURN_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/checkout-return?session_id={CHECKOUT_SESSION_ID}`;

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'No membership';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RenewScreen() {
  const router = useRouter();
  const { session, profile, membership, refreshProfile } = useAuth();
  const family = useFamilyMembers(profile?.id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(profile ? [profile.id] : []),
  );
  const [working, setWorking] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startCheckout = async () => {
    if (!profile || !session || selected.size === 0 || working) return;
    try {
      // Stage the renewal selections (mirrors the website's renewals queue)
      setWorking('Preparing checkout…');
      const { error: clearError } = await supabase
        .from('renewals')
        .delete()
        .or(`id.eq.${profile.id},parent_id.eq.${profile.id}`);
      if (clearError) throw new Error(clearError.message);

      const rows = [...selected].map((id) => ({
        id,
        parent_id: id === profile.id ? null : profile.id,
      }));
      const { error: insertError } = await supabase.from('renewals').insert(rows);
      if (insertError) throw new Error(insertError.message);

      const priceId =
        profile.member_type === 'Charter'
          ? process.env.EXPO_PUBLIC_STRIPE_PRICE_CHARTER
          : process.env.EXPO_PUBLIC_STRIPE_PRICE_DEFAULT;

      const { data: checkout, error: sessionError } = await supabase.functions.invoke(
        'create-checkout-session',
        {
          body: {
            priceId,
            recurring: false,
            user_id: profile.id,
            renewal: true,
            uiMode: 'hosted',
            returnUrl: CHECKOUT_RETURN_URL,
            customerEmail: profile.email ?? undefined,
          },
        },
      );
      if (sessionError || !checkout?.url) {
        throw new Error(sessionError?.message ?? 'Could not start checkout');
      }

      // Open Stripe's hosted checkout; it deep-links back via checkout-return
      setWorking('Waiting for payment…');
      const result = await WebBrowser.openAuthSessionAsync(checkout.url, 'd14://checkout-complete');
      if (result.type !== 'success') {
        setWorking(null);
        return; // user closed the browser
      }
      const sessionId = new URL(result.url).searchParams.get('session_id');
      if (!sessionId || sessionId === 'cancelled') {
        setWorking(null);
        return;
      }

      setWorking('Confirming payment…');
      const { data: fulfillment, error: fulfillError } = await supabase.functions.invoke(
        'fulfill-checkout',
        { body: { session_id: sessionId } },
      );
      if (fulfillError) throw new Error(fulfillError.message);

      if (fulfillment.status === 'fulfilled' || fulfillment.status === 'already_fulfilled') {
        await refreshProfile();
        Alert.alert('Membership Renewed!', 'Your membership has been extended for another year.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (fulfillment.status === 'pending') {
        Alert.alert(
          'Payment Processing',
          'Your payment is still processing. Your membership will update automatically once it completes.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        throw new Error(fulfillment.message ?? 'Fulfillment failed');
      }
    } catch (error) {
      Alert.alert('Renewal failed', error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(null);
    }
  };

  const selfExpiration = membership?.expiration;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Select the memberships you&apos;d like to renew. Each renewal extends the membership one
        year.
      </Text>

      <Widget header="Memberships">
        {profile ? (
          <SelectableRow
            name={[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'You'}
            detail={`Expires ${formatDate(selfExpiration)}`}
            selected={selected.has(profile.id)}
            onToggle={() => toggle(profile.id)}
          />
        ) : null}
        {family.data?.map((f) => (
          <SelectableRow
            key={f.id}
            name={[f.first_name, f.last_name].filter(Boolean).join(' ')}
            detail={`Expires ${formatDate(f.memberships?.expiration)}`}
            selected={selected.has(f.id)}
            onToggle={() => toggle(f.id)}
          />
        ))}
      </Widget>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (selected.size === 0 || !!working) && styles.buttonDisabled,
          pressed && { backgroundColor: D14Colors.redDark },
        ]}
        onPress={startCheckout}
        disabled={selected.size === 0 || !!working}>
        {working ? (
          <View style={styles.workingRow}>
            <ActivityIndicator color={D14Colors.white} />
            <Text style={styles.buttonText}>{working}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            Continue to Payment ({selected.size} membership{selected.size === 1 ? '' : 's'})
          </Text>
        )}
      </Pressable>
      <Text style={styles.hint}>
        Payment is processed securely by Stripe. You&apos;ll be returned to the app when finished.
      </Text>
    </ScrollView>
  );
}

function SelectableRow({
  name,
  detail,
  selected,
  onToggle,
}: {
  name: string;
  detail: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <Ionicons
        name={selected ? 'checkbox' : 'square-outline'}
        size={22}
        color={selected ? D14Colors.red : D14Colors.textTertiary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  intro: { color: D14Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  rowName: { color: D14Colors.white, fontSize: 15, fontWeight: '600' },
  rowDetail: { color: D14Colors.textSecondary, fontSize: 12, marginTop: 2 },
  button: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.three,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: D14Colors.white, fontSize: 15, fontWeight: '700' },
  workingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hint: {
    color: D14Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
