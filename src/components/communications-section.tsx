import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Spacing } from '@/constants/theme';
import {
  EMAIL_CONSENT_TEXT,
  fetchMyConsents,
  PUSH_CONSENT_TEXT,
  recordConsent,
  type ConsentChannel,
} from '@/lib/prospect-signup';
import { registerPushToken, unregisterPushToken } from '@/lib/push';

/**
 * Push / marketing-email opt-ins for the signed-in user. Every change is a
 * new row in the consent log (communication_consents), with this wording.
 */
export function CommunicationsSection({ profileId }: { profileId: string }) {
  // Members who never chose default to push on, email off.
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
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
        label="Email news & offers"
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
        trackColor={{ true: D14Colors.red, false: D14Colors.surfaceSelected }}
        thumbColor={D14Colors.white}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: D14Colors.border },
  label: { color: D14Colors.white, fontSize: 14 },
  text: { color: D14Colors.textTertiary, fontSize: 11, lineHeight: 15, marginTop: 2 },
});
