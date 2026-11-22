import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { formatCardDate, MembershipCard } from '@/components/membership-card';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { removeFamilyMember } from '@/lib/new-membership';
import { useFamilyMembers } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

function formatBirthdate(iso: string | null | undefined) {
  if (!iso) return '—';
  // Birthdates are plain dates (YYYY-MM-DD): don't shift them by time zone
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

/** One family member: their card (for the gate), details and what the holder can do. */
export default function FamilyMemberScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const family = useFamilyMembers(profile?.id);
  const member = family.data?.find((f) => f.id === id);
  const [now] = useState(() => Date.now());
  const [removing, setRemoving] = useState(false);

  if (!member) {
    return (
      <View style={[styles.container, styles.center]}>
        {family.isPending ? (
          <ActivityIndicator color={c.red} />
        ) : (
          <Text style={styles.muted}>This family member isn&apos;t on your account.</Text>
        )}
      </View>
    );
  }

  const name = [member.first_name, member.last_name].filter(Boolean).join(' ');
  const firstName = member.first_name || 'them';
  const expiration = member.memberships?.expiration;
  const paid = !!expiration;

  const confirmRemove = () =>
    Alert.alert(
      `Remove ${name}?`,
      `${name} was added but their membership was never paid for. Removing them deletes this family entry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeFamilyMember(member.id);
              await queryClient.invalidateQueries({ queryKey: ['family'] });
              router.back();
            } catch (err) {
              Alert.alert('Could not remove', err instanceof Error ? err.message : String(err));
              setRemoving(false);
            }
          },
        },
      ],
    );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: member.first_name || 'Family Member' }} />

      {paid ? (
        <>
          <MembershipCard
            profileId={member.id}
            name={name}
            d14Number={member.d14_number}
            amaNumber={member.ama_number}
            memberType={member.member_type}
            expiration={expiration}
            now={now}
          />
          <Text style={styles.gateHint}>Show this card at the gate for {firstName}.</Text>
        </>
      ) : (
        <Widget header="Membership not paid">
          <Text style={styles.muted}>
            {name} was added to your account, but their membership was never paid for, so they
            don&apos;t have a card. Add them again from the Family screen to pay, or remove this
            entry.
          </Text>
        </Widget>
      )}

      <Widget header="Details">
        <Row label="Birthdate" value={formatBirthdate(member.birthdate)} />
        <Row label="AMA Number" value={member.ama_number || '—'} />
        <Row label="D14 Number" value={member.d14_number?.toString() ?? '—'} />
        <Row label="Disciplines" value={member.disciplines?.join(', ') || '—'} />
        <Row label="Expires" value={formatCardDate(expiration)} last />
      </Widget>

      {paid ? (
        <>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && { backgroundColor: c.redDark }]}
            onPress={() => router.push({ pathname: '/renew', params: { ids: member.id } })}>
            <Ionicons name="refresh" size={18} color={c.onAccent} />
            <Text style={styles.buttonText}>Renew {firstName}&apos;s Membership</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            onPress={() =>
              router.push({
                pathname: '/family/convert',
                params: { id: member.id },
              })
            }>
            <Ionicons name="key" size={18} color={c.text} />
            <Text style={styles.secondaryText}>Give {firstName} Their Own Login</Text>
          </Pressable>
          <Text style={styles.hint}>
            For family members who are grown up or moving out: they get their own account and card,
            and you no longer manage them.
          </Text>
        </>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          onPress={confirmRemove}
          disabled={removing}>
          {removing ? (
            <ActivityIndicator color={c.error} />
          ) : (
            <Text style={[styles.secondaryText, { color: c.error }]}>Remove {firstName}</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
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
  muted: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  gateHint: {
    color: c.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: -Spacing.two,
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: Spacing.three,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  label: { color: c.textSecondary, fontSize: 13 },
  value: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: Spacing.two,
  },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  secondary: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingVertical: 14,
    marginTop: Spacing.three,
  },
  secondaryText: { color: c.text, fontSize: 15, fontWeight: '600' },
  hint: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.two,
  },
}));
