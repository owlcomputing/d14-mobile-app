import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

type FormField = {
  key:
    | 'cell_phone'
    | 'home_phone'
    | 'address_line1'
    | 'address_line2'
    | 'city'
    | 'state'
    | 'zip'
    | 'emergency_contact_name'
    | 'emergency_contact_phone';
  label: string;
  keyboard?: 'phone-pad' | 'default';
  autoCapitalize?: 'words' | 'characters' | 'none';
};

const FIELDS: FormField[] = [
  { key: 'cell_phone', label: 'Cell Phone', keyboard: 'phone-pad' },
  { key: 'home_phone', label: 'Home Phone', keyboard: 'phone-pad' },
  { key: 'address_line1', label: 'Address Line 1', autoCapitalize: 'words' },
  { key: 'address_line2', label: 'Address Line 2', autoCapitalize: 'words' },
  { key: 'city', label: 'City', autoCapitalize: 'words' },
  { key: 'state', label: 'State', autoCapitalize: 'characters' },
  { key: 'zip', label: 'ZIP' },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name', autoCapitalize: 'words' },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', keyboard: 'phone-pad' },
];

export default function EditProfileScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, (profile?.[f.key] as string | null) ?? ''])),
  );
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!profile || saving) return;
    setSaving(true);
    const updates: { [K in FormField['key']]?: string | null } = {};
    for (const f of FIELDS) updates[f.key] = values[f.key].trim() || null;
    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    setSaving(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    await refreshProfile();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>
          Name, email, and membership details are managed by the district — contact D14 to change
          them.
        </Text>
        {FIELDS.map((f) => (
          <View key={f.key}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={styles.input}
              value={values[f.key]}
              onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
              keyboardType={f.keyboard ?? 'default'}
              autoCapitalize={f.autoCapitalize ?? 'none'}
              placeholderTextColor={c.textTertiary}
            />
          </View>
        ))}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { backgroundColor: c.redDark }]}
          onPress={onSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  note: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  label: {
    color: c.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.three,
    marginBottom: 6,
  },
  input: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: c.text,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.four,
  },
  buttonText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
}));
