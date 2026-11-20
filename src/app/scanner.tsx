import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  hasId,
  MEMBER_DIRECTORY_COLUMNS,
  MemberResult,
  type MemberResultData,
} from '@/components/member-result';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { makeStyles, useColors } from '@/lib/theme';

type ScannedMember = { id: string };

function parseQr(data: string): ScannedMember | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed?.t === 'd14-member' && typeof parsed.id === 'string') return { id: parsed.id };
  } catch {
    // not our QR format
  }
  return null;
}

function useScannedMember(id: string | null) {
  return useQuery({
    queryKey: ['scanned-member', id],
    enabled: !!id,
    queryFn: async (): Promise<MemberResultData | null> => {
      const { data, error } = await supabase
        .from('member_directory')
        .select(MEMBER_DIRECTORY_COLUMNS)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data && hasId(data) ? data : null;
    },
  });
}

export default function ScannerScreen() {
  const c = useColors();
  const styles = useStyles();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [badScan, setBadScan] = useState(false);
  const member = useScannedMember(scannedId);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="camera" size={40} color={c.textTertiary} />
        <Text style={styles.permissionText}>
          Camera access is needed to scan member QR codes at the gate.
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  const onScan = ({ data }: { data: string }) => {
    if (scannedId) return; // already showing a result
    const parsed = parseQr(data);
    if (parsed) {
      setBadScan(false);
      setScannedId(parsed.id);
    } else {
      setBadScan(true);
    }
  };

  const reset = () => {
    setScannedId(null);
    setBadScan(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scannedId ? undefined : onScan}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.overlayHint}>Point at a member&apos;s D14 card QR code</Text>
      </View>

      <View style={styles.resultPanel}>
        {badScan ? (
          <Text style={styles.badScan}>Not a D14 membership QR code</Text>
        ) : null}
        {scannedId ? (
          member.isLoading ? (
            <Text style={styles.loading}>Verifying…</Text>
          ) : member.data ? (
            <MemberResult member={member.data} />
          ) : (
            <Text style={styles.badScan}>Member not found</Text>
          )
        ) : null}
        {scannedId || badScan ? (
          <Pressable style={styles.button} onPress={reset}>
            <Text style={styles.buttonText}>Scan Again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: c.red,
    borderRadius: Radius.xl,
    backgroundColor: 'transparent',
  },
  // Over the live camera image: always white with a shadow
  overlayHint: {
    color: c.onAccent,
    fontSize: 13,
    marginTop: Spacing.three,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  resultPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    backgroundColor: withAlpha(c.background, 0.92),
  },
  permissionText: {
    color: c.textSecondary,
    textAlign: 'center',
    marginVertical: Spacing.three,
    lineHeight: 20,
  },
  button: {
    backgroundColor: c.red,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: Spacing.two,
  },
  buttonText: { color: c.onAccent, fontWeight: '700', fontSize: 14 },
  badScan: { color: c.warning, textAlign: 'center', marginBottom: Spacing.two },
  loading: { color: c.textSecondary, textAlign: 'center', marginBottom: Spacing.two },
}));
