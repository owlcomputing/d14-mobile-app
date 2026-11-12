import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInPrompt } from '@/components/sign-in-prompt';
import { WalletDocumentsSection } from '@/components/wallet-documents-section';
import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useFamilyMembers } from '@/lib/queries';
import { useAuth } from '@/providers/auth-provider';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WalletScreen() {
  const { session, isMember, profileReady } = useAuth();
  if (!session) return <GuestWallet />;
  if (!profileReady) {
    return (
      <SafeAreaView style={[styles.safe, styles.loading]} edges={['top']}>
        <ActivityIndicator color={D14Colors.red} />
      </SafeAreaView>
    );
  }
  if (!isMember) return <ProspectWallet />;
  return <MemberWallet />;
}

/** Signed in for race reminders, but not (yet) a D14 member. */
function ProspectWallet() {
  const { profile } = useAuth();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Your digital D14 card lives here once you join</Text>
        <SignInPrompt
          variant="prospect"
          icon="card"
          title="Become a D14 member"
          message="Members get a digital membership card with a QR code for the gate, right here in the app. Join on the D14 website using this same email address."
        />
        {profile && Platform.OS !== 'web' ? (
          <WalletDocumentsSection profileId={profile.id} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function GuestWallet() {
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
  const router = useRouter();
  const { profile, membership } = useAuth();
  const family = useFamilyMembers(profile?.id);

  const active = membership ? new Date(membership.expiration) >= new Date() : false;
  const expiringSoon =
    active &&
    membership != null &&
    new Date(membership.expiration).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  // QR payload for gate verification — verified by the lookup/scanner screen
  const qrValue = JSON.stringify({ v: 1, t: 'd14-member', id: profile?.id, d14: profile?.d14_number });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Membership Card</Text>
        <Text style={styles.subtitle}>Present at the gate for verification</Text>

        {/* The card */}
        <View style={styles.card}>
          <View style={styles.cardDecorCircle} />
          <View style={styles.cardDecorCircle2} />
          <Text style={styles.cardLogo}>AMA DISTRICT 14</Text>
          <Text style={styles.cardName}>{fullName || 'Member'}</Text>
          <Text style={styles.cardNumber}>
            D14 #{profile?.d14_number ?? '—'}
            {profile?.ama_number ? `  •  AMA #${profile.ama_number}` : ''}
          </Text>
          <View style={styles.cardRow}>
            <View style={styles.cardDetails}>
              <View style={styles.cardDetail}>
                <Text style={styles.cardDetailLabel}>Type</Text>
                <Text style={styles.cardDetailValue}>{profile?.member_type ?? '—'}</Text>
              </View>
              <View style={styles.cardDetail}>
                <Text style={styles.cardDetailLabel}>Expires</Text>
                <Text style={styles.cardDetailValue}>{formatDate(membership?.expiration)}</Text>
              </View>
              <View style={styles.cardDetail}>
                <Text style={styles.cardDetailLabel}>Status</Text>
                <Text
                  style={[
                    styles.cardDetailValue,
                    { color: active ? D14Colors.success : D14Colors.error },
                  ]}>
                  {active ? 'Active' : 'Expired'}
                </Text>
              </View>
            </View>
            <View style={styles.qrBox}>
              {profile ? <QRCode value={qrValue} size={92} backgroundColor="#FFFFFF" /> : null}
            </View>
          </View>
        </View>

        {/* Member details */}
        <Widget header="Member Details">
          <DetailRow label="Disciplines" value={profile?.disciplines?.join(', ') || '—'} />
          <DetailRow label="Member Type" value={profile?.member_type ?? '—'} />
          <DetailRow label="D14 Number" value={profile?.d14_number?.toString() ?? '—'} />
          <DetailRow label="AMA Number" value={profile?.ama_number?.toString() ?? '—'} last />
        </Widget>

        {/* AMA card, minor release, etc. stored on this device (works offline).
            expo-file-system's File/Directory API isn't available on web. */}
        {profile && Platform.OS !== 'web' ? (
          <WalletDocumentsSection profileId={profile.id} />
        ) : null}

        {/* Renew — always available; early renewals extend from the current
            expiration date, so no time is lost */}
        <Pressable
          style={({ pressed }) => [
            styles.renewButton,
            active && !expiringSoon && styles.renewButtonQuiet,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.push('/renew')}>
          <Text style={styles.renewButtonText}>
            {!active
              ? 'Renew Membership'
              : expiringSoon
                ? 'Renew Membership — Expiring Soon'
                : 'Renew Early'}
          </Text>
        </Pressable>

        {/* Family members */}
        {family.data?.length ? (
          <Widget header="Family Members">
            {family.data.map((f, i) => {
              const exp = f.memberships?.expiration;
              const fActive = exp ? new Date(exp) >= new Date() : false;
              return (
                <DetailRow
                  key={f.id}
                  label={[f.first_name, f.last_name].filter(Boolean).join(' ')}
                  value={fActive ? `Active thru ${formatDate(exp)}` : 'Expired'}
                  valueColor={fActive ? D14Colors.success : D14Colors.error}
                  last={i === family.data.length - 1}
                />
              );
            })}
          </Widget>
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
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D14Colors.black },
  loading: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  title: { color: D14Colors.white, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    color: D14Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.four,
  },
  card: {
    backgroundColor: D14Colors.surfaceRaised,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    overflow: 'hidden',
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderColor: D14Colors.border,
  },
  cardDecorCircle: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(230,57,70,0.35)',
  },
  cardDecorCircle2: {
    position: 'absolute',
    bottom: -40,
    right: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(230,57,70,0.18)',
  },
  cardLogo: {
    color: D14Colors.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: Spacing.three,
  },
  cardName: { color: D14Colors.white, fontSize: 20, fontWeight: '700' },
  cardNumber: {
    color: D14Colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
    marginBottom: Spacing.three,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardDetails: { gap: Spacing.two },
  cardDetail: {},
  cardDetailLabel: {
    color: D14Colors.textTertiary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDetailValue: { color: D14Colors.white, fontSize: 13, fontWeight: '600', marginTop: 1 },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: Radius.md, padding: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: D14Colors.border },
  renewButton: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: Spacing.three,
  },
  renewButtonQuiet: {
    backgroundColor: D14Colors.surface,
    borderWidth: 1,
    borderColor: D14Colors.border,
  },
  renewButtonText: { color: D14Colors.white, fontSize: 14, fontWeight: '700' },
  detailLabel: { color: D14Colors.textSecondary, fontSize: 13 },
  detailValue: { color: D14Colors.white, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
});
