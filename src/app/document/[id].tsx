import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { D14Colors, Radius, Spacing } from '@/constants/theme';
import {
  deleteWalletDoc,
  docUri,
  getWalletDoc,
  renameWalletDoc,
  type WalletDoc,
} from '@/lib/wallet-documents';
import { useAuth } from '@/providers/auth-provider';

/** Full-screen view of one wallet document, e.g. to show at the gate. */
export default function DocumentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [doc, setDoc] = useState<WalletDoc | undefined>(() =>
    profile ? getWalletDoc(profile.id, id) : undefined,
  );
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(doc?.title ?? '');

  if (!profile || !doc) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: 'Document' }} />
        <Text style={styles.missingText}>This document is no longer on this phone.</Text>
      </View>
    );
  }

  const uri = docUri(profile.id, doc);

  const share = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing is not available on this device');
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: doc.mimeType ?? undefined,
      UTI: doc.kind === 'pdf' ? 'com.adobe.pdf' : 'public.image',
      dialogTitle: doc.title,
    });
  };

  const saveRename = () => {
    renameWalletDoc(profile.id, doc.id, draft);
    setDoc(getWalletDoc(profile.id, doc.id));
    setRenaming(false);
  };

  const confirmDelete = () =>
    Alert.alert('Delete document?', `"${doc.title}" will be removed from this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWalletDoc(profile.id, doc.id);
          router.back();
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: doc.title }} />

      <View style={styles.body}>
        {doc.kind === 'image' ? (
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={doc.title}
          />
        ) : (
          <View style={styles.pdf}>
            <Ionicons name="document-text" size={72} color={D14Colors.red} />
            <Text style={styles.pdfTitle}>{doc.title}</Text>
            <Pressable
              style={({ pressed }) => [styles.openPdf, pressed && { opacity: 0.85 }]}
              onPress={share}>
              <Text style={styles.openPdfText}>Open PDF</Text>
            </Pressable>
            <Text style={styles.pdfHint}>Opens in your phone&apos;s PDF viewer.</Text>
          </View>
        )}
      </View>

      {renaming ? (
        <View style={styles.renameBar}>
          <TextInput
            style={styles.renameInput}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={saveRename}
            placeholderTextColor={D14Colors.textTertiary}
          />
          <Pressable style={styles.renameSave} onPress={saveRename}>
            <Text style={styles.renameSaveText}>Save</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Action icon="create-outline" label="Rename" onPress={() => setRenaming(true)} />
          <Action icon="share-outline" label="Share" onPress={share} />
          <Action icon="trash-outline" label="Delete" onPress={confirmDelete} danger />
        </View>
      )}
    </SafeAreaView>
  );
}

function Action({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? D14Colors.error : D14Colors.white;
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D14Colors.black },
  body: { flex: 1 },
  image: { flex: 1 },
  pdf: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  pdfTitle: { color: D14Colors.white, fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
  openPdf: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.five,
    marginTop: Spacing.four,
  },
  openPdfText: { color: D14Colors.white, fontSize: 15, fontWeight: '700' },
  pdfHint: { color: D14Colors.textTertiary, fontSize: 12, marginTop: Spacing.two },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: D14Colors.border,
    backgroundColor: D14Colors.surface,
  },
  action: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  actionLabel: { fontSize: 11, fontWeight: '600' },
  renameBar: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: D14Colors.border,
    backgroundColor: D14Colors.surface,
  },
  renameInput: {
    flex: 1,
    backgroundColor: D14Colors.surfaceRaised,
    borderRadius: Radius.md,
    color: D14Colors.white,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  renameSave: {
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  renameSaveText: { color: D14Colors.white, fontWeight: '700' },
  missing: {
    flex: 1,
    backgroundColor: D14Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  missingText: { color: D14Colors.textSecondary, fontSize: 14, textAlign: 'center' },
});
