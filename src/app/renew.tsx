import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { runHostedCheckout } from '@/lib/checkout';
import { useFamilyMembers } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'No membership';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function expiryText(iso: string | null | undefined, now: number) {
  if (!iso) return 'No membership';
  return `${new Date(iso).getTime() < now ? 'Expired' : 'Expires'} ${formatDate(iso)}`;
}

export default function RenewScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, profile, membership, refreshProfile } = useAuth();
  const family = useFamilyMembers(profile?.id);
  // Opened for specific people (e.g. from a family member's screen)
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  // Only memberships that exist can be renewed (fulfillment extends an
  // existing expiration date). Family members never paid for are left out.
  const renewableFamily = (family.data ?? []).filter((f) => f.memberships);
  const renewableIds = [
    ...(profile && membership ? [profile.id] : []),
    ...renewableFamily.map((f) => f.id),
  ];
  // Until the member changes it: the requested people; else everyone expired
  // or expiring within 90 days; else yourself (family-only holders: the
  // whole family)
  const [now] = useState(() => Date.now());
  const soon = now + 90 * 24 * 60 * 60 * 1000;
  const due = [
    ...(profile && membership && new Date(membership.expiration).getTime() < soon
      ? [profile.id]
      : []),
    ...renewableFamily
      .filter((f) => new Date(f.memberships!.expiration).getTime() < soon)
      .map((f) => f.id),
  ];
  const requested = ids?.split(',').filter((id) => renewableIds.includes(id)) ?? [];
  const defaultSelection = requested.length
    ? requested
    : due.length
      ? due
      : profile && membership
        ? [profile.id]
        : renewableFamily.map((f) => f.id);
  const selected = chosen ?? new Set(defaultSelection);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
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

      const outcome = await runHostedCheckout(
        {
          priceId,
          user_id: profile.id,
          renewal: true,
          customerEmail: profile.email ?? undefined,
        },
        setWorking,
      );

      if (outcome === 'paid') {
        await refreshProfile();
        await queryClient.invalidateQueries({ queryKey: ['family'] });
        Alert.alert(
          selected.size === 1 ? 'Membership Renewed!' : 'Memberships Renewed!',
          selected.size === 1 && profile && selected.has(profile.id)
            ? 'Your membership has been extended for another year.'
            : 'The selected memberships have been extended for another year.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else if (outcome === 'processing') {
        // Back from the post-payment page, but the payment is still settling
        Alert.alert(
          'Payment Processing',
          'Your payment is still processing. Your membership will update automatically once it completes.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Checkout Not Completed', 'No payment was made. You can try again anytime.');
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
        Select the memberships you&apos;d like to renew. Each renewal adds one year to the current
        expiration date — renewing early never costs you time.
      </Text>

      <Widget header="Memberships">
        {profile && membership ? (
          <SelectableRow
            name={[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'You'}
            detail={expiryText(selfExpiration, now)}
            selected={selected.has(profile.id)}
            onToggle={() => toggle(profile.id)}
          />
        ) : null}
        {renewableFamily.map((f) => (
          <SelectableRow
            key={f.id}
            name={[f.first_name, f.last_name].filter(Boolean).join(' ')}
            detail={expiryText(f.memberships?.expiration, now)}
            selected={selected.has(f.id)}
            onToggle={() => toggle(f.id)}
          />
        ))}
      </Widget>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (selected.size === 0 || !!working) && styles.buttonDisabled,
          pressed && { backgroundColor: c.redDark },
        ]}
        onPress={startCheckout}
        disabled={selected.size === 0 || !!working}>
        {working ? (
          <View style={styles.workingRow}>
            <ActivityIndicator color={c.onAccent} />
            <Text style={styles.buttonText}>{working}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            Continue to Payment ({selected.size} membership
            {selected.size === 1 ? '' : 's'})
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
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <Ionicons
        name={selected ? 'checkbox' : 'square-outline'}
        size={22}
        color={selected ? c.red : c.textTertiary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
    </Pressable>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  rowName: { color: c.text, fontSize: 15, fontWeight: '600' },
  rowDetail: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.three,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  workingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hint: {
    color: c.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
}));
