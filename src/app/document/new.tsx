import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { D14Colors, Radius, Spacing } from '@/constants/theme';
import {
  addWalletDoc,
  clearPendingPick,
  getPendingPick,
  kindForMime,
  SUGGESTED_TITLES,
} from '@/lib/wallet-documents';
import { useAuth } from '@/providers/auth-provider';

/** Name and save a picked photo/PDF into the wallet. Reached from WalletDocumentsSection. */
export default function NewDocumentScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  // Picked file handed over in memory by WalletDocumentsSection
  const [pick] = useState(getPendingPick);
  const uri = pick?.uri;
  const mimeType = pick?.mimeType ?? null;
  const name = pick?.name ?? null;
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const kind = kindForMime(mimeType);

  if (!pick) {
    return (
      <View style={[styles.container, styles.missing]}>
        <Text style={styles.missingText}>Nothing to add. Go back and pick a photo or file.</Text>
      </View>
    );
  }

  const save = async () => {
    if (!profile || !uri || saving) return;
    setSaving(true);
    try {
      await addWalletDoc(profile.id, {
        sourceUri: uri,
        title: title || (kind === 'pdf' ? name || 'Document' : 'Document'),
        mimeType,
        sourceName: name,
      });
      clearPendingPick();
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save document', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.preview}>
          {kind === 'image' && uri ? (
            <Image source={{ uri }} style={styles.previewImage} contentFit="contain" />
          ) : (
            <View style={styles.pdfPreview}>
              <Ionicons name="document-text" size={56} color={D14Colors.red} />
              <Text style={styles.pdfName} numberOfLines={2}>
                {name || 'PDF document'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. AMA Card"
          placeholderTextColor={D14Colors.textTertiary}
          returnKeyType="done"
          maxLength={60}
        />
        <View style={styles.chips}>
          {SUGGESTED_TITLES.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, title === t && styles.chipActive]}
              onPress={() => setTitle(t)}>
              <Text style={[styles.chipText, title === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.note}>
          Saved only on this phone, available offline. It won&apos;t be uploaded or shared unless you
          choose to share it.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.save, pressed && { backgroundColor: D14Colors.redDark }]}
          onPress={save}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color={D14Colors.white} />
          ) : (
            <Text style={styles.saveText}>Save to Wallet</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  missing: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  missingText: { color: D14Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  preview: {
    height: 260,
    borderRadius: Radius.lg,
    backgroundColor: D14Colors.surface,
    borderWidth: 1,
    borderColor: D14Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.four,
  },
  previewImage: { flex: 1 },
  pdfPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  pdfName: { color: D14Colors.textSecondary, fontSize: 13, marginTop: Spacing.two, textAlign: 'center' },
  label: {
    color: D14Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  input: {
    backgroundColor: D14Colors.surface,
    borderColor: D14Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: D14Colors.white,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: D14Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: D14Colors.border,
  },
  chipActive: { backgroundColor: D14Colors.red, borderColor: D14Colors.red },
  chipText: { color: D14Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: D14Colors.white },
  note: {
    color: D14Colors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.four,
  },
  save: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: Spacing.four,
  },
  saveText: { color: D14Colors.white, fontSize: 16, fontWeight: '700' },
});
