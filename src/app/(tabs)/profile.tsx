import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut, isAdmin, isChairman } = useAuth();

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('');

  const confirmSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
          <Text style={styles.name}>{fullName || 'Member'}</Text>
          <Text style={styles.meta}>
            {profile?.member_type ?? 'Member'}
            {profile?.d14_number ? ` • D14 #${profile.d14_number}` : ''}
          </Text>
          {isAdmin || isChairman ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{isAdmin ? 'Admin' : 'Chairman'}</Text>
            </View>
          ) : null}
        </View>

        <Widget header="Contact Info">
          <InfoRow icon="mail" label={profile?.email ?? '—'} />
          <InfoRow icon="call" label={profile?.cell_phone || profile?.home_phone || '—'} />
          <InfoRow
            icon="location"
            label={
              [profile?.address_line1, profile?.city, profile?.state].filter(Boolean).join(', ') ||
              '—'
            }
            last
          />
        </Widget>

        <Widget header="Tools">
          <MenuRow
            icon="search"
            label="Member Lookup"
            hint="Verify membership by name or number"
            onPress={() => router.push('/lookup')}
          />
          <MenuRow
            icon="qr-code"
            label="Scan QR Code"
            hint="Verify a member card at the gate"
            onPress={() => router.push('/scanner')}
          />
          <MenuRow
            icon="people"
            label="District Contacts"
            hint="Officers and division contacts"
            onPress={() => router.push('/contacts')}
            last
          />
        </Widget>

        <Pressable style={styles.signOut} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, last }: { icon: any; label: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Ionicons name={icon} size={16} color={D14Colors.textTertiary} />
      <Text style={styles.rowText}>{label}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  onPress,
  last,
}: {
  icon: any;
  label: string;
  hint: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}
      onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={16} color={D14Colors.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  header: { alignItems: 'center', marginVertical: Spacing.four },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: D14Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avatarText: { color: D14Colors.white, fontSize: 26, fontWeight: '800' },
  name: { color: D14Colors.white, fontSize: 20, fontWeight: '700' },
  meta: { color: D14Colors.textSecondary, fontSize: 13, marginTop: 2 },
  roleBadge: {
    backgroundColor: D14Colors.surfaceRaised,
    borderColor: D14Colors.red,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: Spacing.two,
  },
  roleBadgeText: { color: D14Colors.red, fontSize: 11, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: D14Colors.border },
  rowText: { color: D14Colors.white, fontSize: 14 },
  rowHint: { color: D14Colors.textTertiary, fontSize: 11, marginTop: 1 },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: D14Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { color: D14Colors.textTertiary, fontSize: 20, fontWeight: '300' },
  signOut: { alignItems: 'center', paddingVertical: Spacing.three },
  signOutText: { color: D14Colors.error, fontSize: 14, fontWeight: '600' },
});
