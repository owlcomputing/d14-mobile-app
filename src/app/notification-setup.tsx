import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useEmailDefault } from '@/components/communications-section';
import { DivisionChecklist } from '@/components/division-checklist';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import {
  loadDivisionChoice,
  markNotificationSetupDone,
  saveDivisionChoice,
} from '@/lib/notification-prefs';
import {
  EMAIL_CONSENT_TEXT,
  fetchMyConsents,
  PUSH_CONSENT_TEXT,
  recordConsent,
  type ConsentChannel,
} from '@/lib/prospect-signup';
import {
  getDevicePushToken,
  getPushPermission,
  registerPushToken,
  requestPushPermission,
  unregisterPushToken,
  type PushPermission,
} from '@/lib/push';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

const STEPS = 3;
const SOURCE = 'app:first-sign-in';

type Loaded = {
  permission: PushPermission;
  consents: Partial<Record<ConsentChannel, boolean>>;
  /** True if they've set anything before (website unsubscribe, another phone, sign-up) */
  hadPrefs: boolean;
};

/**
 * Shown once after someone first signs in on this phone: walks through
 * push notifications, the divisions they follow, and email updates. Starts
 * from whatever they've already chosen (website, another phone), so it's
 * also a chance to review it. Everything here can be changed later in
 * Profile.
 */
export default function NotificationSetupScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { profile } = useAuth();
  const profileId = profile?.id;
  const emailDefault = useEmailDefault(profileId ?? '');

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [step, setStep] = useState(0);
  /** The push choice made here; null = not asked or not possible (leave as is) */
  const [pushChoice, setPushChoice] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  const [divisions, setDivisions] = useState<string[] | null>(null);
  const [emailChoice, setEmailChoice] = useState<boolean | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const email = emailChoice ?? loaded?.consents.email_marketing ?? emailDefault;

  useEffect(() => {
    if (!profileId) return;
    // Offered once per person per phone, even if they close the app midway
    markNotificationSetupDone(profileId);
    let alive = true;
    (async () => {
      const [permission, consents, token] = await Promise.all([
        getPushPermission(),
        fetchMyConsents(profileId),
        getDevicePushToken(),
      ]);
      const choice = await loadDivisionChoice(profileId, token).catch(() => ({
        divisions: null,
        saved: false,
      }));
      if (!alive) return;
      setDivisions(choice.divisions);
      setLoaded({
        permission,
        consents,
        hadPrefs: choice.saved || Object.keys(consents).length > 0,
      });
    })();
    return () => {
      alive = false;
    };
  }, [profileId]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  /** Leave everything as it was; register push quietly if it's already allowed. */
  const skip = useCallback(() => {
    if (profileId && loaded?.permission === 'granted' && loaded.consents.push !== false) {
      void registerPushToken(profileId, undefined, { prompt: false });
    }
    close();
  }, [profileId, loaded, close]);

  // Android back button: previous step, or skip from the first one
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving) return true;
      if (step > 0) setStep(step - 1);
      else skip();
      return true;
    });
    return () => sub.remove();
  }, [step, saving, skip]);

  const allowPush = async () => {
    setAsking(true);
    const result = await requestPushPermission();
    setAsking(false);
    setLoaded((l) => (l ? { ...l, permission: result } : l));
    // Declined in the phone's prompt: leave their saved choice alone, so
    // turning it on later in the phone's Settings is enough.
    setPushChoice(result === 'granted' ? true : null);
    setStep(1);
  };

  /** Notifications were blocked: they may have just turned them on in Settings. */
  const continueAfterSettings = async () => {
    const result = await getPushPermission();
    setLoaded((l) => (l ? { ...l, permission: result } : l));
    if (result === 'granted') setPushChoice(true);
    setStep(1);
  };

  const finish = async () => {
    if (!profileId || !loaded || saving) return;
    setSaving(true);
    try {
      if (pushChoice !== null) await recordConsent(profileId, 'push', pushChoice, SOURCE);
      await recordConsent(profileId, 'email_marketing', email, SOURCE);
      await saveDivisionChoice(profileId, null, divisions);

      const pushOn = pushChoice ?? loaded.consents.push !== false;
      if (pushOn) await registerPushToken(profileId, divisions, { prompt: false });
      else await unregisterPushToken();
      close();
    } catch (e) {
      Alert.alert(
        'Could not save',
        `${e instanceof Error ? e.message : String(e)}\n\nCheck your connection and try again.`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.red} />
      </View>
    );
  }

  const { permission } = loaded;
  const alreadyOn = permission === 'granted' && loaded.consents.push !== false;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={skip} hitSlop={12} disabled={saving}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 ? (
          <>
            <StepHeader icon="notifications" title="Stay in the loop">
              Get race-day updates, event reminders and district news on your phone. Let&apos;s set
              up what you hear about. It takes a few seconds, and you can change it any time in
              Profile.
            </StepHeader>
            {loaded.hadPrefs ? (
              <Note icon="checkmark-circle">
                You&apos;ve set some of this up before, so your current choices are filled in.
                Review them and change anything you like.
              </Note>
            ) : null}
            {permission === 'unavailable' ? (
              <Note icon="notifications-off">
                Push notifications aren&apos;t available on this device. You can still choose your
                divisions and email updates.
              </Note>
            ) : permission === 'blocked' ? (
              <Note icon="notifications-off">
                Notifications for D14 are turned off in your phone&apos;s settings. To get them,
                turn them on there.
              </Note>
            ) : (
              <Text style={styles.small}>{PUSH_CONSENT_TEXT}</Text>
            )}
          </>
        ) : step === 1 ? (
          <>
            <StepHeader icon="flag" title="Pick your divisions">
              Choose the divisions whose races and news you want to hear about. District-wide
              announcements always come through.
            </StepHeader>
            <Widget>
              <DivisionChecklist value={divisions} onChange={setDivisions} />
            </Widget>
          </>
        ) : (
          <>
            <StepHeader icon="mail" title="Email updates">
              We can also email you district news and event reminders.
            </StepHeader>
            <Widget>
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>{EMAIL_CONSENT_TEXT}</Text>
                <Switch
                  value={email}
                  onValueChange={setEmailChoice}
                  trackColor={{ true: c.red, false: c.surfaceSelected }}
                  thumbColor={c.onAccent}
                  accessibilityLabel="Email news and event reminders"
                />
              </View>
            </Widget>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step === 0 ? (
          permission === 'unavailable' ? (
            <Primary label="Continue" onPress={() => setStep(1)} />
          ) : permission === 'blocked' ? (
            <>
              <Primary label="Continue" onPress={continueAfterSettings} />
              <Secondary label="Open Phone Settings" onPress={() => Linking.openSettings()} />
            </>
          ) : (
            <>
              <Primary
                label={alreadyOn ? 'Keep Notifications On' : 'Turn On Notifications'}
                onPress={allowPush}
                busy={asking}
              />
              <Secondary
                label={alreadyOn ? 'Turn Them Off' : 'Not Now'}
                onPress={() => {
                  setPushChoice(false);
                  setStep(1);
                }}
              />
            </>
          )
        ) : (
          <>
            {step < STEPS - 1 ? (
              <Primary label="Next" onPress={() => setStep(step + 1)} />
            ) : (
              <Primary label="Finish" onPress={finish} busy={saving} />
            )}
            <Secondary label="Back" onPress={() => setStep(step - 1)} disabled={saving} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function StepHeader({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.stepHeader}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={30} color={c.red} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

function Note({
  icon,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.note}>
      <Ionicons name={icon} size={18} color={c.textTertiary} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

function Primary({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.primary, pressed && { backgroundColor: c.redDark }]}
      onPress={onPress}
      disabled={busy}>
      {busy ? (
        <ActivityIndicator color={c.onAccent} />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

function Secondary({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  center: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.surfaceSelected },
  dotActive: { width: 22, backgroundColor: c.red },
  skip: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  content: { padding: Spacing.four, paddingBottom: Spacing.five },
  stepHeader: { alignItems: 'center', marginTop: Spacing.four, marginBottom: Spacing.four },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: { color: c.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: {
    color: c.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: c.surface,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  noteText: { flex: 1, color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  small: { color: c.textTertiary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.one },
  primary: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
  },
  primaryText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
  secondary: { alignItems: 'center', paddingVertical: 13 },
  secondaryText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
}));
