import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  Image as RNImage,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import RenderHtml, {
  useContentWidth,
  type CustomBlockRenderer,
  type MixedStyleRecord,
} from 'react-native-render-html';

import { D14Colors, Radius, Spacing } from '@/constants/theme';

const COLLAPSED_HEIGHT = 220;

const tagsStyles: MixedStyleRecord = {
  body: { color: D14Colors.white, fontSize: 14, lineHeight: 21 },
  p: { marginTop: 0, marginBottom: 12 },
  a: { color: D14Colors.red, textDecorationColor: D14Colors.red },
  h1: { fontSize: 20, marginBottom: 8, color: D14Colors.white },
  h2: { fontSize: 18, marginBottom: 8, color: D14Colors.white },
  h3: { fontSize: 16, marginBottom: 6, color: D14Colors.white },
  li: { marginBottom: 4 },
  strong: { color: D14Colors.white },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: D14Colors.red,
    paddingLeft: 12,
    marginLeft: 0,
    color: D14Colors.textSecondary,
  },
};

/**
 * Replaces the default <img> renderer. The website's WYSIWYG editor embeds
 * images as base64 data URIs, which the default renderer mishandles; expo-image
 * decodes them off the JS thread and we size by intrinsic aspect ratio.
 */
const HtmlImage: CustomBlockRenderer = ({ tnode }) => {
  const contentWidth = useContentWidth();
  const src = tnode.attributes.src ?? '';
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!src) return;
    RNImage.getSize(
      src,
      (w, h) => setAspectRatio(h > 0 ? w / h : 4 / 3),
      () => setAspectRatio(4 / 3),
    );
  }, [src]);

  if (!src) return null;
  return (
    <ExpoImage
      source={{ uri: src }}
      style={{
        width: contentWidth,
        aspectRatio: aspectRatio ?? 4 / 3,
        borderRadius: Radius.sm,
        marginBottom: 12,
        backgroundColor: D14Colors.surfaceRaised,
      }}
      contentFit="contain"
    />
  );
};

const renderers = { img: HtmlImage };

type HtmlContentProps = {
  html: string;
  width?: number;
  /** Collapse tall content behind a "See more" toggle (default true) */
  collapsible?: boolean;
};

/**
 * Renders CMS/TinyMCE HTML with dark-theme styling. Content taller than the
 * collapsed height gets a fade-out and a "See more" toggle.
 */
export function HtmlContent({ html, width, collapsible = true }: HtmlContentProps) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = width ?? windowWidth - Spacing.three * 4;
  const [expanded, setExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const collapsed = collapsible && !expanded && contentHeight > COLLAPSED_HEIGHT + 40;
  const showToggle = collapsible && contentHeight > COLLAPSED_HEIGHT + 40;

  return (
    <View>
      <View style={collapsed ? { height: COLLAPSED_HEIGHT, overflow: 'hidden' } : null}>
        <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          <RenderHtml
            contentWidth={contentWidth}
            source={{ html }}
            tagsStyles={tagsStyles}
            renderers={renderers}
            renderersProps={{
              a: {
                onPress: (_event, href) => {
                  if (href) WebBrowser.openBrowserAsync(href);
                },
              },
            }}
          />
        </View>
        {collapsed ? <View style={styles.fade} /> : null}
      </View>
      {showToggle ? (
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
          <Text style={styles.toggle}>{expanded ? 'See less' : 'See more'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    // RN can't gradient without a lib; a translucent scrim reads as a fade
    backgroundColor: 'rgba(22,22,22,0.75)',
  },
  toggle: {
    color: D14Colors.red,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
});
