import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import RenderHtml, { type MixedStyleRecord } from 'react-native-render-html';

import { D14Colors, Spacing } from '@/constants/theme';

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
 * Renders CMS/TinyMCE HTML with dark-theme styling. Content taller than the
 * collapsed height gets a fade-out and a "See more" toggle.
 */
export function HtmlContent({ html, width }: { html: string; width?: number }) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = width ?? windowWidth - Spacing.three * 4;
  const [expanded, setExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const collapsible = contentHeight > COLLAPSED_HEIGHT + 40;

  return (
    <View>
      <View
        style={!expanded && collapsible ? { height: COLLAPSED_HEIGHT, overflow: 'hidden' } : null}>
        <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          <RenderHtml
            contentWidth={contentWidth}
            source={{ html }}
            tagsStyles={tagsStyles}
            renderersProps={{
              a: {
                onPress: (_event, href) => {
                  if (href) WebBrowser.openBrowserAsync(href);
                },
              },
            }}
          />
        </View>
        {!expanded && collapsible ? <View style={styles.fade} /> : null}
      </View>
      {collapsible ? (
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
