// Crop (and rotate) a wallet photo before it's saved: the step between taking
// or choosing a photo and the "Add Document" screen.
//
// The photo is first re-saved through expo-image-manipulator and that copy is
// what's shown and cropped, so the on-screen image and the crop coordinates
// always agree (the manipulator works in the image's pixels and, on Android,
// doesn't apply EXIF rotation itself; Rotate fixes a sideways photo).
//
// Always dark, like the camera, in both app appearances.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearPendingPick, getPendingPick, setPendingPick } from '@/lib/wallet-documents';

const RED = '#E63946';
const MIN_SIZE = 48; // smallest crop box, in screen points
const HANDLE = 28;
// Decode big camera photos at a sensible size (plenty for a card or form)
const MAX_PIXELS = 3000;

type Size = { width: number; height: number };
type Rect = { x: number; y: number; w: number; h: number }; // image pixels
type Drag = 'move' | 'tl' | 'tr' | 'bl' | 'br';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

async function normalize(uri: string, rotate = 0) {
  const context = ImageManipulator.manipulate(uri, { maxWidth: MAX_PIXELS, maxHeight: MAX_PIXELS });
  if (rotate) context.rotate(rotate);
  const image = await context.renderAsync();
  return image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
}

export default function CropDocumentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pick] = useState(getPendingPick);
  const [image, setImage] = useState<{ uri: string } & Size | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [frame, setFrame] = useState<Size | null>(null);
  const [busy, setBusy] = useState<'load' | 'rotate' | 'save' | null>('load');

  // Load the photo through the manipulator (see the note at the top)
  useEffect(() => {
    if (!pick) return;
    normalize(pick.uri)
      .then((r) => {
        setImage({ uri: r.uri, width: r.width, height: r.height });
        setRect({ x: 0, y: 0, w: r.width, h: r.height });
      })
      .catch(() => {
        // Can't edit this picture; save it as it is
        router.replace('/document/new');
      })
      .finally(() => setBusy(null));
  }, [pick, router]);

  // Where the image sits inside the frame (fit, centered), in screen points
  const layout = useMemo(() => {
    if (!image || !frame) return null;
    const scale = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    return { scale, width, height, left: (frame.width - width) / 2, top: (frame.height - height) / 2 };
  }, [image, frame]);

  // Drag handlers, rebuilt when the image or its on-screen size changes. Each
  // move applies the change since the previous move (in image pixels) to the
  // current crop box through a state updater, so no refs are needed.
  const responders = useMemo(() => {
    if (!image || !layout) return null;
    const min = MIN_SIZE / layout.scale;
    const apply = (drag: Drag, r: Rect, dx: number, dy: number): Rect => {
      if (drag === 'move') {
        return {
          ...r,
          x: clamp(r.x + dx, 0, image.width - r.w),
          y: clamp(r.y + dy, 0, image.height - r.h),
        };
      }
      let left = r.x;
      let top = r.y;
      let right = r.x + r.w;
      let bottom = r.y + r.h;
      if (drag === 'tl' || drag === 'bl') left = clamp(left + dx, 0, right - min);
      if (drag === 'tr' || drag === 'br') right = clamp(right + dx, left + min, image.width);
      if (drag === 'tl' || drag === 'tr') top = clamp(top + dy, 0, bottom - min);
      if (drag === 'bl' || drag === 'br') bottom = clamp(bottom + dy, top + min, image.height);
      return { x: left, y: top, w: right - left, h: bottom - top };
    };
    const make = (drag: Drag) => {
      let lastX = 0;
      let lastY = 0;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          lastX = 0;
          lastY = 0;
        },
        onPanResponderMove: (_e, g) => {
          const dx = (g.dx - lastX) / layout.scale;
          const dy = (g.dy - lastY) / layout.scale;
          lastX = g.dx;
          lastY = g.dy;
          setRect((r) => (r ? apply(drag, r, dx, dy) : r));
        },
      });
    };
    return {
      move: make('move'),
      tl: make('tl'),
      tr: make('tr'),
      bl: make('bl'),
      br: make('br'),
    };
  }, [image, layout]);

  const onFrameLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrame({ width, height });
  };

  const rotate = async () => {
    if (!image || busy) return;
    setBusy('rotate');
    try {
      const r = await normalize(image.uri, 90);
      setImage({ uri: r.uri, width: r.width, height: r.height });
      setRect({ x: 0, y: 0, w: r.width, h: r.height });
    } catch {
      Alert.alert('Could not rotate', 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const reset = () => image && setRect({ x: 0, y: 0, w: image.width, h: image.height });

  const done = async () => {
    if (!image || !rect || busy) return;
    setBusy('save');
    try {
      const x = Math.floor(rect.x);
      const y = Math.floor(rect.y);
      const crop = {
        originX: x,
        originY: y,
        width: Math.min(Math.round(rect.w), image.width - x),
        height: Math.min(Math.round(rect.h), image.height - y),
      };
      const whole = crop.width >= image.width - 1 && crop.height >= image.height - 1;
      let uri = image.uri;
      if (!whole) {
        const cropped = await ImageManipulator.manipulate(image.uri).crop(crop).renderAsync();
        uri = (await cropped.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })).uri;
      }
      setPendingPick({ uri, mimeType: 'image/jpeg', name: null });
      router.replace('/document/new');
    } catch {
      setBusy(null);
      Alert.alert('Could not crop the photo', 'Please try again.');
    }
  };

  const cancel = () => {
    clearPendingPick();
    router.back();
  };

  if (!pick) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.message}>Nothing to crop. Go back and take or choose a photo.</Text>
      </View>
    );
  }

  // Crop box in screen points, relative to the frame
  const box =
    layout && rect
      ? {
          left: layout.left + rect.x * layout.scale,
          top: layout.top + rect.y * layout.scale,
          width: rect.w * layout.scale,
          height: rect.h * layout.scale,
        }
      : null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={cancel} hitSlop={12}>
              <Text style={styles.headerButton}>Cancel</Text>
            </Pressable>
          ),
        }}
      />
      <Text style={styles.hint}>Drag the corners to crop to just the card or page.</Text>

      <View style={styles.frame} onLayout={onFrameLayout}>
        {image && layout && box && responders ? (
          <>
            <Image
              source={{ uri: image.uri }}
              style={{ position: 'absolute', left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
              contentFit="fill"
            />
            {/* Dim everything outside the crop box */}
            <View style={[styles.shade, { left: layout.left, top: layout.top, width: layout.width, height: box.top - layout.top }]} />
            <View style={[styles.shade, { left: layout.left, top: box.top + box.height, width: layout.width, height: layout.top + layout.height - box.top - box.height }]} />
            <View style={[styles.shade, { left: layout.left, top: box.top, width: box.left - layout.left, height: box.height }]} />
            <View style={[styles.shade, { left: box.left + box.width, top: box.top, width: layout.left + layout.width - box.left - box.width, height: box.height }]} />

            <View style={[styles.box, box]} {...responders.move.panHandlers}>
              <View style={[styles.grid, { left: '33.3%' }]} />
              <View style={[styles.grid, { left: '66.6%' }]} />
              <View style={[styles.gridH, { top: '33.3%' }]} />
              <View style={[styles.gridH, { top: '66.6%' }]} />
            </View>
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <View
                key={corner}
                {...responders[corner].panHandlers}
                hitSlop={16}
                style={[
                  styles.handle,
                  {
                    left: (corner === 'tl' || corner === 'bl' ? box.left : box.left + box.width) - HANDLE / 2,
                    top: (corner === 'tl' || corner === 'tr' ? box.top : box.top + box.height) - HANDLE / 2,
                  },
                ]}
              />
            ))}
          </>
        ) : null}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <Pressable style={styles.tool} onPress={rotate} disabled={!!busy} hitSlop={8}>
          <Ionicons name="refresh" size={22} color="#FFFFFF" />
          <Text style={styles.toolText}>Rotate</Text>
        </Pressable>
        <Pressable style={styles.tool} onPress={reset} disabled={!!busy} hitSlop={8}>
          <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
          <Text style={styles.toolText}>Reset</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]}
          onPress={done}
          disabled={!!busy}>
          <Text style={styles.doneText}>Use Photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { color: '#A5A9B0', fontSize: 14, textAlign: 'center' },
  headerButton: { color: '#FFFFFF', fontSize: 16 },
  hint: { color: '#A5A9B0', fontSize: 13, textAlign: 'center', marginTop: 12, marginHorizontal: 16 },
  frame: { flex: 1, margin: 24 },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  box: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF' },
  grid: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: RED,
  },
  busy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  tool: { alignItems: 'center', gap: 2 },
  toolText: { color: '#FFFFFF', fontSize: 11 },
  done: {
    flex: 1,
    backgroundColor: RED,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
