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
  Text,
  TextInput,
  View,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
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
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { profile, isMember } = useAuth();
  // Picked file handed over in memory by WalletDocumentsSection
  const [pick] = useState(getPendingPick);
  const uri = pick?.uri;
  const mimeType = pick?.mimeType ?? null;
  const name = pick?.name ?? null;
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const kind = kindForMime(mimeType);

  // Wallet documents are members-only (the Wallet tab doesn't offer them to prospects).
  if (!pick || !isMember) {
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
              <Ionicons name="document-text" size={56} color={c.red} />
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
          placeholderTextColor={c.textTertiary}
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
          style={({ pressed }) => [styles.save, pressed && { backgroundColor: c.redDark }]}
          onPress={save}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <Text style={styles.saveText}>Save to Wallet</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  missing: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  missingText: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  preview: {
    height: 260,
    borderRadius: Radius.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    marginBottom: Spacing.four,
  },
  previewImage: { flex: 1 },
  pdfPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  pdfName: { color: c.textSecondary, fontSize: 13, marginTop: Spacing.two, textAlign: 'center' },
  label: {
    color: c.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  input: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: c.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.red, borderColor: c.red },
  chipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: c.onAccent },
  note: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.four,
  },
  save: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: Spacing.four,
  },
  saveText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
}));
