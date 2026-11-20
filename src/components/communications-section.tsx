import { useCallback, useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { Spacing } from '@/constants/theme';
import {
  EMAIL_CONSENT_TEXT,
  fetchMyConsents,
  PUSH_CONSENT_TEXT,
  recordConsent,
  type ConsentChannel,
} from '@/lib/prospect-signup';
import { registerPushToken, unregisterPushToken } from '@/lib/push';
import { useFamilyMembers } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

const isCurrent = (expiration: string | null | undefined) =>
  !!expiration && new Date(expiration).getTime() >= Date.now();

type MembershipJoin = { expiration: string } | { expiration: string }[] | null;

/**
 * Push / marketing-email opt-ins for the signed-in user. Every change is a
 * new row in the consent log (communication_consents), with this wording.
 */
export function CommunicationsSection({ profileId }: { profileId: string }) {
  const { membership } = useAuth();
  const family = useFamilyMembers(profileId);
  // Same rule as the server (notification_email_targets): a household with a
  // current membership gets email unless they opt out; everyone else only if
  // they opt in. Push defaults to on.
  const householdMember =
    isCurrent(membership?.expiration) ||
    (family.data ?? []).some((m) => {
      const joined = m.memberships as MembershipJoin;
      const rows = Array.isArray(joined) ? joined : joined ? [joined] : [];
      return rows.some((r) => isCurrent(r.expiration));
    });
  const [push, setPush] = useState(true);
  // undefined = never chosen: show the default for their membership status
  const [emailChoice, setEmail] = useState<boolean | undefined>(undefined);
  const email = emailChoice ?? householdMember;
  const [saving, setSaving] = useState<ConsentChannel | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyConsents(profileId).then((c) => {
      if (!alive) return;
      if (c.push !== undefined) setPush(c.push);
      if (c.email_marketing !== undefined) setEmail(c.email_marketing);
    });
    return () => {
      alive = false;
    };
  }, [profileId]);

  const change = useCallback(
    async (channel: ConsentChannel, on: boolean) => {
      const set = channel === 'push' ? setPush : setEmail;
      set(on);
      setSaving(channel);
      try {
        await recordConsent(profileId, channel, on, 'app:settings');
        if (channel === 'push') {
          if (on) await registerPushToken(profileId);
          else await unregisterPushToken();
        }
      } catch {
        set(!on);
        Alert.alert('Could not save', 'Please check your connection and try again.');
      } finally {
        setSaving(null);
      }
    },
    [profileId],
  );

  return (
    <Widget header="Communications">
      <ConsentRow
        label="Push notifications"
        text={PUSH_CONSENT_TEXT}
        value={push}
        disabled={saving === 'push'}
        onChange={(on) => change('push', on)}
      />
      <ConsentRow
        label="Email news & event reminders"
        text={EMAIL_CONSENT_TEXT}
        value={email}
        disabled={saving === 'email_marketing'}
        onChange={(on) => change('email_marketing', on)}
        last
      />
    </Widget>
  );
}

function ConsentRow({
  label,
  text,
  value,
  disabled,
  onChange,
  last,
}: {
  label: string;
  text: string;
  value: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
  last?: boolean;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: c.red, false: c.surfaceSelected }}
        thumbColor={c.onAccent}
        accessibilityLabel={label}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  label: { color: c.text, fontSize: 14 },
  text: { color: c.textTertiary, fontSize: 11, lineHeight: 15, marginTop: 2 },
}));
