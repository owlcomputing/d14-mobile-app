import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunicationsSection } from '@/components/communications-section';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAppLock } from '@/providers/app-lock-provider';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const { session } = useAuth();
  if (!session) return <GuestProfile />;
  return <MemberProfile />;
}

function GuestProfile() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, styles.guestAvatar]}>
            <Ionicons name="person" size={30} color={D14Colors.textSecondary} />
          </View>
          <Text style={styles.name}>Guest</Text>
          <Text style={styles.meta}>Browsing AMA District 14</Text>
        </View>

        <SignInPrompt
          icon="person-circle"
          title="Sign in to your account"
          message="Members can manage their profile and family, renew their membership, and choose which divisions send them notifications."
        />

        <Widget header="Explore">
          <MenuRow
            icon="mic"
            label="Podcast & Media"
            hint="The Dirtbike Download and magazine archive"
            onPress={() => router.push('/media')}
          />
          <MenuRow
            icon="people"
            label="District Contacts"
            hint="Officers and division contacts"
            onPress={() => router.push('/contacts')}
            last
          />
        </Widget>
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberProfile() {
  const router = useRouter();
  const { session, profile, signOut, isAdmin, isChairman, isMember, profileReady } = useAuth();
  const appLock = useAppLock();
  const [deleting, setDeleting] = useState(false);
  // Gate tools (member lookup, QR scanner) read member_directory, which only
  // members, chairmen and admins can see.
  const canCheckMembers = isMember || isAdmin || isChairman;
  const isProspect = profileReady && !canCheckMembers;

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('');

  const confirmSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      if (data?.result === 'deleted') {
        Alert.alert('Account deleted', 'Your account and its data have been removed.');
        await signOut();
      } else {
        Alert.alert(
          'Request sent',
          'Because your account has membership records, the D14 secretary will confirm with you by email and complete the deletion.',
        );
      }
    } catch {
      Alert.alert('Could not delete account', 'Please check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      isProspect
        ? 'This permanently deletes your account, your notification settings and your saved choices. Documents in your wallet stay on this phone until you remove them.'
        : 'Your account has membership records, so we will send a deletion request to the D14 secretary, who will confirm with you by email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isProspect ? 'Delete' : 'Send Request',
          style: 'destructive',
          onPress: () => void deleteAccount(),
        },
      ],
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
          <Text style={styles.name}>{fullName || (isProspect ? 'Welcome' : 'Member')}</Text>
          <Text style={styles.meta}>
            {isProspect ? (
              'Race reminders • not a member yet'
            ) : (
              <>
                {profile?.member_type ?? 'Member'}
                {profile?.d14_number ? ` • D14 #${profile.d14_number}` : ''}
              </>
            )}
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

        {isProspect ? (
          <SignInPrompt
            variant="prospect"
            icon="ribbon"
            title="Become a D14 member"
            message="Join on the D14 website with this same email address. Your account becomes a member account, with your digital card in the Wallet."
          />
        ) : null}

        <Widget header="Tools">
          <MenuRow
            icon="create"
            label="Edit Profile"
            hint="Update contact and address info"
            onPress={() => router.push('/edit-profile')}
          />
          {canCheckMembers ? (
            <>
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
            </>
          ) : null}
          <MenuRow
            icon="people"
            label="District Contacts"
            hint="Officers and division contacts"
            onPress={() => router.push('/contacts')}
            last={!isAdmin}
          />
          {isAdmin ? (
            <MenuRow
              icon="megaphone"
              label="Send Notification"
              hint="Push a message to members (admin)"
              onPress={() => router.push('/send-notification')}
              last
            />
          ) : null}
        </Widget>

        {session && profile ? <CommunicationsSection profileId={profile.id} /> : null}

        <Widget header="Settings">
          <MenuRow
            icon="notifications"
            label="Notification Preferences"
            hint="Choose divisions for push notifications"
            onPress={() => router.push('/notification-settings')}
          />
          <MenuRow
            icon="mic"
            label="Podcast & Media"
            hint="The Dirtbike Download and magazine archive"
            onPress={() => router.push('/media')}
          />
          <View style={[styles.row]}>
            <View style={styles.menuIcon}>
              <Ionicons name="finger-print" size={16} color={D14Colors.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>App Lock</Text>
              <Text style={styles.rowHint}>
                {appLock.biometricsAvailable
                  ? 'Require Face ID / fingerprint to open the app'
                  : 'No biometrics enrolled on this device'}
              </Text>
            </View>
            <Switch
              value={appLock.enabled}
              onValueChange={(on) => {
                void appLock.setEnabled(on);
              }}
              disabled={!appLock.biometricsAvailable}
              trackColor={{ true: D14Colors.red, false: D14Colors.surfaceSelected }}
              thumbColor={D14Colors.white}
            />
          </View>
        </Widget>

        <Pressable style={styles.signOut} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
        <Pressable style={styles.deleteAccount} onPress={confirmDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color={D14Colors.textTertiary} />
          ) : (
            <Text style={styles.deleteAccountText}>Delete my account</Text>
          )}
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
  guestAvatar: { backgroundColor: D14Colors.surfaceRaised },
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
  deleteAccount: { alignItems: 'center', paddingBottom: Spacing.three },
  deleteAccountText: { color: D14Colors.textTertiary, fontSize: 12, textDecorationLine: 'underline' },
});
