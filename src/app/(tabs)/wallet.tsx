import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCardDate, MembershipCard } from '@/components/membership-card';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { WalletDocumentsSection } from '@/components/wallet-documents-section';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { useFamilyMembers } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

export default function WalletScreen() {
  const c = useColors();
  const styles = useStyles();
  const { session, isMember, profileReady } = useAuth();
  if (!session) return <GuestWallet />;
  if (!profileReady) {
    return (
      <SafeAreaView style={[styles.safe, styles.loading]} edges={['top']}>
        <ActivityIndicator color={c.red} />
      </SafeAreaView>
    );
  }
  if (!isMember) return <ProspectWallet />;
  return <MemberWallet />;
}

/** Signed in for race reminders, but not (yet) a D14 member. The Wallet is members-only. */
function ProspectWallet() {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>For AMA District 14 members</Text>
        <SignInPrompt
          variant="prospect"
          icon="lock-closed"
          title="The Wallet is for members only"
          message="Members get a digital membership card with a QR code for the gate, plus a place to keep their AMA card and minor release, all available offline. Join on the D14 website using this same email address."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function GuestWallet() {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Membership Card</Text>
        <Text style={styles.subtitle}>Your digital D14 card lives here</Text>
        <SignInPrompt
          icon="card"
          title="Sign in to see your card"
          message="Members can show their D14 membership card and QR code at the gate, right from their phone. Not a member yet? Join on the D14 website."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberWallet() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { profile, membership, isFamilyHolder } = useAuth();
  const family = useFamilyMembers(profile?.id);

  // The time the screen opened (reading the clock during render isn't allowed)
  const [now] = useState(() => Date.now());
  const soon = now + 90 * 24 * 60 * 60 * 1000;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  // Renew button: prominent when anything (yours or a family member's) has
  // expired or expires within 90 days
  const expirations = [
    ...(membership ? [membership.expiration] : []),
    ...(family.data ?? []).flatMap((f) => (f.memberships ? [f.memberships.expiration] : [])),
  ].map((e) => new Date(e).getTime());
  const active = membership ? new Date(membership.expiration).getTime() >= now : false;
  const needsRenewal = expirations.some((t) => t < soon);
  const anyExpired = expirations.some((t) => t < now);
  const renewable = expirations.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{isFamilyHolder ? 'Family Cards' : 'Membership Card'}</Text>
        <Text style={styles.subtitle}>Present at the gate for verification</Text>

        {profile && !isFamilyHolder ? (
          <>
            <MembershipCard
              profileId={profile.id}
              name={fullName}
              d14Number={profile.d14_number}
              amaNumber={profile.ama_number}
              memberType={profile.member_type}
              expiration={membership?.expiration}
              now={now}
            />

            {/* Member details */}
            <Widget header="Member Details">
              <DetailRow label="Disciplines" value={profile.disciplines?.join(', ') || '—'} />
              <DetailRow label="Member Type" value={profile.member_type ?? '—'} />
              <DetailRow label="D14 Number" value={profile.d14_number?.toString() ?? '—'} />
              <DetailRow label="AMA Number" value={profile.ama_number?.toString() ?? '—'} last />
            </Widget>
          </>
        ) : null}

        {/* Family members: tap one to show their card */}
        {family.data?.length ? (
          <Widget header={isFamilyHolder ? 'Your Family' : 'Family Members'}>
            {family.data.map((f) => {
              const exp = f.memberships?.expiration;
              const fActive = exp ? new Date(exp).getTime() >= now : false;
              return (
                <Pressable
                  key={f.id}
                  style={({ pressed }) => [
                    styles.detailRow,
                    styles.detailRowBorder,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => router.push(`/family/${f.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.familyName}>
                      {[f.first_name, f.last_name].filter(Boolean).join(' ')}
                    </Text>
                    <Text
                      style={[
                        styles.familyStatus,
                        {
                          color: !exp ? c.textTertiary : fActive ? c.success : c.error,
                        },
                      ]}>
                      {!exp
                        ? 'Membership not paid'
                        : fActive
                          ? `Active thru ${formatCardDate(exp)}`
                          : `Expired ${formatCardDate(exp)}`}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
            <Pressable
              style={({ pressed }) => [styles.manageRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/family')}>
              <Ionicons name="people-circle" size={18} color={c.red} />
              <Text style={styles.manageText}>Manage family</Text>
            </Pressable>
          </Widget>
        ) : isFamilyHolder ? (
          <Widget header="Your Family">
            <Text style={styles.detailLabel}>
              {family.isPending ? 'Loading…' : 'No family members yet.'}
            </Text>
          </Widget>
        ) : null}

        {/* AMA card, minor release, etc. stored on this device (works offline).
            expo-file-system's File/Directory API isn't available on web. */}
        {profile && Platform.OS !== 'web' ? (
          <WalletDocumentsSection profileId={profile.id} />
        ) : null}

        {/* Renew — always available; early renewals extend from the current
            expiration date, so no time is lost */}
        {renewable ? (
          <Pressable
            style={({ pressed }) => [
              styles.renewButton,
              !needsRenewal && styles.renewButtonQuiet,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push('/renew')}>
            <Text style={[styles.renewButtonText, !needsRenewal && styles.renewButtonTextQuiet]}>
              {isFamilyHolder
                ? 'Renew Family Memberships'
                : !active
                  ? 'Renew Membership'
                  : needsRenewal && !anyExpired
                    ? 'Renew — Expiring Soon'
                    : needsRenewal
                      ? 'Renew Memberships'
                      : 'Renew Early'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
  last,
}: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  loading: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  title: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: c.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.four,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  renewButton: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: Spacing.three,
  },
  renewButtonQuiet: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  renewButtonText: { color: c.onAccent, fontSize: 14, fontWeight: '700' },
  renewButtonTextQuiet: { color: c.text },
  detailLabel: { color: c.textSecondary, fontSize: 13 },
  detailValue: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  familyName: { color: c.text, fontWeight: '600', flex: 1 },
  familyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chevron: { color: c.textTertiary, fontSize: 20, fontWeight: '300' },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: 12,
  },
  manageText: { color: c.text, fontSize: 13, fontWeight: '600' },
}));
