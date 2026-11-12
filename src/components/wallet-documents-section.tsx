import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';
import { docUri, useWalletDocs, type WalletDoc } from '@/lib/wallet-documents';

type Picked = { uri: string; mimeType: string | null; name: string | null };

function formatAdded(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "My Documents" on the member wallet: AMA card, minor release, etc., kept on this device. */
export function WalletDocumentsSection({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { docs } = useWalletDocs(profileId);

  const openAdd = (picked: Picked) =>
    router.push({
      pathname: '/document/new',
      params: { uri: picked.uri, mimeType: picked.mimeType ?? '', name: picked.name ?? '' },
    });

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in Settings to photograph documents for your wallet.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) {
      const a = result.assets[0];
      openAdd({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', name: a.fileName ?? null });
    }
  };

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) {
      const a = result.assets[0];
      openAdd({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', name: a.fileName ?? null });
    }
  };

  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      openAdd({ uri: a.uri, mimeType: a.mimeType ?? null, name: a.name });
    }
  };

  return (
    <Widget header="My Documents">
      {docs.length ? (
        docs.map((doc, i) => (
          <DocRow
            key={doc.id}
            doc={doc}
            uri={docUri(profileId, doc)}
            last={i === docs.length - 1}
            onPress={() => router.push(`/document/${doc.id}`)}
          />
        ))
      ) : (
        <Text style={styles.empty}>
          Keep photos of your AMA card, AMA minor release and other documents here. They&apos;re
          saved on this phone, so they work at the gate even without signal.
        </Text>
      )}

      <View style={styles.addRow}>
        <AddButton icon="camera" label="Camera" onPress={takePhoto} />
        <AddButton icon="images" label="Photos" onPress={choosePhoto} />
        <AddButton icon="document-attach" label="File" onPress={chooseFile} />
      </View>
    </Widget>
  );
}

function DocRow({
  doc,
  uri,
  last,
  onPress,
}: {
  doc: WalletDoc;
  uri: string;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${doc.title}`}>
      {doc.kind === 'image' ? (
        <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.pdfThumb]}>
          <Ionicons name="document-text" size={22} color={D14Colors.red} />
          <Text style={styles.pdfLabel}>PDF</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <Text style={styles.rowMeta}>Added {formatAdded(doc.createdAt)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function AddButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Add document from ${label}`}>
      <Ionicons name={icon} size={18} color={D14Colors.red} />
      <Text style={styles.addLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { color: D14Colors.textSecondary, fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: D14Colors.border },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: D14Colors.surfaceRaised,
  },
  pdfThumb: { alignItems: 'center', justifyContent: 'center' },
  pdfLabel: { color: D14Colors.textSecondary, fontSize: 9, fontWeight: '700', marginTop: 1 },
  rowText: { flex: 1 },
  rowTitle: { color: D14Colors.white, fontSize: 14, fontWeight: '600' },
  rowMeta: { color: D14Colors.textTertiary, fontSize: 11, marginTop: 2 },
  chevron: { color: D14Colors.textTertiary, fontSize: 20, fontWeight: '300' },
  addRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: D14Colors.border,
    backgroundColor: D14Colors.surfaceRaised,
  },
  addLabel: { color: D14Colors.white, fontSize: 13, fontWeight: '600' },
});
