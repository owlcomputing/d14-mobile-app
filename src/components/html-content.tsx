import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import RenderHtml, {
  useContentWidth,
  type CustomBlockRenderer,
  type MixedStyleRecord,
  type TNode,
} from 'react-native-render-html';

import { Radius, Spacing, withAlpha, type Palette } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';

const COLLAPSED_HEIGHT = 220;

/** Tag styles for the active palette (one object per palette, so RenderHtml can memoize). */
const tagsStylesCache = new WeakMap<Palette, MixedStyleRecord>();
function tagsStylesFor(c: Palette): MixedStyleRecord {
  let styles = tagsStylesCache.get(c);
  if (!styles) {
    styles = {
      body: { color: c.text, fontSize: 14, lineHeight: 21 },
      p: { marginTop: 0, marginBottom: 12 },
      a: { color: c.red, textDecorationColor: c.red },
      h1: { fontSize: 20, marginBottom: 8, color: c.text },
      h2: { fontSize: 18, marginBottom: 8, color: c.text },
      h3: { fontSize: 16, marginBottom: 6, color: c.text },
      li: { marginBottom: 4 },
      strong: { color: c.text },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: c.red,
        paddingLeft: 12,
        marginLeft: 0,
        color: c.textSecondary,
      },
    };
    tagsStylesCache.set(c, styles);
  }
  return styles;
}

type Alignment = 'flex-start' | 'center' | 'flex-end';
/** A photo's width: pixels, or a percentage of the content width. */
type Size = { px: number } | { percent: number };

/** Size from a width/height attribute or style value ("354", "354px", "50%"). */
function parseSize(value: string | undefined): Size | null {
  const n = value ? parseFloat(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return value!.trim().endsWith('%') ? { percent: n } : { px: n };
}

/** One property from an inline style attribute ("width: 50%; display: block"). */
function styleValue(style: string | undefined, property: string) {
  const match = style?.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1].trim().toLowerCase();
}

/**
 * Horizontal alignment. The website editors' photo toolbar saves it on the
 * image (float left/right, or display: block + margin: auto to center); older
 * pages use a ql-align-* class on the image's paragraph.
 */
function imageAlignment(tnode: TNode): Alignment {
  const style = tnode.attributes.style;
  const float = styleValue(style, 'float');
  if (float === 'left') return 'flex-start';
  if (float === 'right') return 'flex-end';
  if (styleValue(style, 'display') === 'block' && styleValue(style, 'margin')?.startsWith('auto')) {
    return 'center';
  }
  for (let node: TNode | null = tnode; node; node = node.parent) {
    if (node.classes.includes('ql-align-center')) return 'center';
    if (node.classes.includes('ql-align-right')) return 'flex-end';
  }
  return 'flex-start';
}

/**
 * Replaces the default <img> renderer. Like the website, a photo shows at the
 * size set in the editor (style width, e.g. "50%" of the page width) or its
 * width attribute, else at its own size, and is scaled down to fit the
 * screen, so small logos aren't stretched to full width. The height follows
 * the photo's shape. Images that fail to load are hidden.
 */
const HtmlImage: CustomBlockRenderer = ({ tnode }) => {
  const c = useColors();
  const contentWidth = useContentWidth();
  const src = tnode.attributes.src ?? '';
  const size =
    parseSize(styleValue(tnode.attributes.style, 'width')) ?? parseSize(tnode.attributes.width);
  const attrWidth = parseSize(tnode.attributes.width);
  const attrHeight = parseSize(tnode.attributes.height);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);

  if (!src || failed) return null;

  // Before the photo loads (no size set): full width at 16:9
  const sized =
    size && 'percent' in size
      ? (contentWidth * Math.min(size.percent, 100)) / 100
      : (size?.px ?? natural?.width ?? contentWidth);
  const width = Math.min(sized, contentWidth);
  const aspectRatio = natural
    ? natural.width / natural.height
    : attrWidth && 'px' in attrWidth && attrHeight && 'px' in attrHeight
      ? attrWidth.px / attrHeight.px
      : 16 / 9;

  return (
    <ExpoImage
      source={{ uri: src }}
      onLoad={(e) => {
        const { width: w, height: h } = e.source;
        if (w > 0 && h > 0) setNatural({ width: w, height: h });
      }}
      onError={() => setFailed(true)}
      style={{
        width,
        maxWidth: '100%',
        aspectRatio,
        alignSelf: imageAlignment(tnode),
        borderRadius: Radius.sm,
        marginBottom: 12,
        backgroundColor: natural ? undefined : c.surfaceRaised,
      }}
      contentFit="contain"
      cachePolicy="memory-disk"
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
 * Renders CMS/TinyMCE HTML styled for the active palette. Content taller than the
 * collapsed height gets a fade-out and a "See more" toggle.
 */
export function HtmlContent({ html, width, collapsible = true }: HtmlContentProps) {
  const c = useColors();
  const styles = useStyles();
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
            tagsStyles={tagsStylesFor(c)}
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

const useStyles = makeStyles((c) => ({
  fade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    // RN can't gradient without a lib; a translucent scrim reads as a fade
    backgroundColor: withAlpha(c.surface, 0.75),
  },
  toggle: {
    color: c.red,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
}));
