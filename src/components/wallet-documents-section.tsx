import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import {
  docUri,
  setPendingPick,
  stageImageBase64,
  stagePickedFile,
  useWalletDocs,
  type WalletDoc,
} from '@/lib/wallet-documents';

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
  const styles = useStyles();
  const router = useRouter();
  const { docs } = useWalletDocs(profileId);

  // Hand the pick over in memory, not as route params (see setPendingPick).
  const openAdd = (picked: Picked) => {
    setPendingPick(picked);
    router.push('/document/new');
  };

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
    await run(async () =>
      handleImage(
        await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, base64: true }),
      ),
    );
  };

  const choosePhoto = () =>
    run(async () =>
      handleImage(
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        }),
      ),
    );

  // Use the picker's image data rather than its file: the camera's output file
  // may be outside the folders we're allowed to read (e.g. in Expo Go).
  const handleImage = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) throw new Error('The picture could not be read. Please try again.');
    openAdd({ uri: stageImageBase64(asset.base64), mimeType: 'image/jpeg', name: null });
  };

  const chooseFile = () =>
    run(async () => {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/pdf', 'image/*'] });
      if (picked.canceled) return;
      const file = picked.result;
      openAdd({
        uri: await stagePickedFile(file),
        mimeType: file.type || null,
        name: file.name || null,
      });
    });

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      Alert.alert('Could not add document', e instanceof Error ? e.message : 'Please try again.');
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
  const c = useColors();
  const styles = useStyles();
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
          <Ionicons name="document-text" size={22} color={c.red} />
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
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Add document from ${label}`}>
      <Ionicons name={icon} size={18} color={c.red} />
      <Text style={styles.addLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  empty: { color: c.textSecondary, fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: c.surfaceRaised,
  },
  pdfThumb: { alignItems: 'center', justifyContent: 'center' },
  pdfLabel: { color: c.textSecondary, fontSize: 9, fontWeight: '700', marginTop: 1 },
  rowText: { flex: 1 },
  rowTitle: { color: c.text, fontSize: 14, fontWeight: '600' },
  rowMeta: { color: c.textTertiary, fontSize: 11, marginTop: 2 },
  chevron: { color: c.textTertiary, fontSize: 20, fontWeight: '300' },
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
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  addLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
}));
