import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { formatCardDate } from '@/components/membership-card';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { useFamilyMembers } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

/**
 * The account holder's family: everyone whose membership they manage. Same
 * abilities as the website's profile page: show each card, renew, add a
 * family member, give one their own login, and (family-only holders)
 * become a member themselves.
 */
export default function FamilyScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { profile, membership, isFamilyHolder } = useAuth();
  const family = useFamilyMembers(profile?.id);
  const [now] = useState(() => Date.now());

  const ownActive = membership ? new Date(membership.expiration).getTime() >= now : false;
  // Website rule: a member renews their own (expired) membership before adding
  // family; family-only holders can always add.
  const canAdd = isFamilyHolder || ownActive;
  const canRenew = membership != null || (family.data ?? []).some((f) => f.memberships);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={family.isRefetching}
          onRefresh={() => void family.refetch()}
          tintColor={c.red}
        />
      }>
      <Text style={styles.intro}>
        Family members share your account: you can show their cards at the gate, renew their
        memberships and add new family members.
      </Text>

      <Widget header="Family Members">
        {family.isPending ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : family.isError && !family.data ? (
          <Text style={styles.empty}>Couldn&apos;t load your family. Pull down to try again.</Text>
        ) : !family.data?.length ? (
          <Text style={styles.empty}>No family members yet.</Text>
        ) : (
          family.data.map((f, i) => {
            const exp = f.memberships?.expiration;
            const active = exp ? new Date(exp).getTime() >= now : false;
            return (
              <Pressable
                key={f.id}
                style={({ pressed }) => [
                  styles.row,
                  i < family.data.length - 1 && styles.rowBorder,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.push(`/family/${f.id}`)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {[f.first_name?.[0], f.last_name?.[0]].filter(Boolean).join('') || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {[f.first_name, f.last_name].filter(Boolean).join(' ')}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      {
                        color: !exp ? c.textTertiary : active ? c.success : c.error,
                      },
                    ]}>
                    {!exp
                      ? 'Membership not paid'
                      : active
                        ? `Active thru ${formatCardDate(exp)}`
                        : `Expired ${formatCardDate(exp)}`}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })
        )}
      </Widget>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          !canAdd && styles.disabled,
          pressed && { backgroundColor: c.redDark },
        ]}
        disabled={!canAdd}
        onPress={() => router.push('/family/add')}>
        <Ionicons name="person-add" size={18} color={c.onAccent} />
        <Text style={styles.buttonText}>Add a Family Member</Text>
      </Pressable>
      {!canAdd ? (
        <Text style={styles.hint}>
          Renew your membership first, then you can add a family member.
        </Text>
      ) : null}

      {canRenew ? (
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/renew')}>
          <Ionicons name="refresh" size={18} color={c.text} />
          <Text style={styles.secondaryText}>Renew Memberships</Text>
        </Pressable>
      ) : null}

      {isFamilyHolder ? (
        <Widget header="Want to ride too?" variant="outline" style={styles.upgrade}>
          <Text style={styles.upgradeText}>
            You manage your family&apos;s memberships but don&apos;t have one yourself. Become a
            member to get your own card; you&apos;ll still manage your family.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/family/become-member')}>
            <Ionicons name="ribbon" size={18} color={c.text} />
            <Text style={styles.secondaryText}>Become a Member Yourself</Text>
          </Pressable>
        </Widget>
      ) : null}
    </ScrollView>
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
  empty: { color: c.textSecondary, fontSize: 14, paddingVertical: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: c.text, fontSize: 13, fontWeight: '700' },
  name: { color: c.text, fontSize: 15, fontWeight: '600' },
  status: { fontSize: 12, marginTop: 2 },
  chevron: { color: c.textTertiary, fontSize: 20, fontWeight: '300' },
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
  disabled: { opacity: 0.4 },
  hint: {
    color: c.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
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
  upgrade: { marginTop: Spacing.four },
  upgradeText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
}));
