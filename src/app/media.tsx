import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import WebView from 'react-native-webview';

import { Widget } from '@/components/widget';
import { D14Colors, Radius, Spacing } from '@/constants/theme';

const SPOTIFY_SHOW_ID = '2FGA4qJb5k1Zbx5QA4DgJ0';
const SPOTIFY_EMBED_URL = `https://open.spotify.com/embed/show/${SPOTIFY_SHOW_ID}?utm_source=generator&theme=0`;
const SPOTIFY_SHOW_URL = `https://open.spotify.com/show/${SPOTIFY_SHOW_ID}`;
// The channel's uploads playlist (channel ID with "UC" prefix -> "UU")
const YOUTUBE_PLAYLIST_ID = 'UUaENMUV8qyblQwBLhxnxNzA';
const YOUTUBE_EMBED_URL = `https://www.youtube.com/embed/videoseries?list=${YOUTUBE_PLAYLIST_ID}`;
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@TheDirtbikeDownload';

// Archived issues are hosted externally (flipbook services)
const MAGAZINE_ARCHIVE: { label: string; url: string }[] = [
  { label: 'March 2024', url: 'https://online.flippingbook.com/view/567529744/' },
  { label: 'February 2024', url: 'https://online.flippingbook.com/view/627429942/' },
  { label: 'January 2024', url: 'https://online.flippingbook.com/view/59305815/' },
];

export default function MediaScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>The Dirtbike Download</Text>
      <Text style={styles.subtitle}>
        The official AMA District 14 podcast — riders, race recaps, and district news.
      </Text>

      <Widget header="Listen on Spotify">
        <View style={styles.embed}>
          <WebView
            source={{ uri: SPOTIFY_EMBED_URL }}
            style={styles.webview}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        </View>
        <OpenLink label="Open in Spotify" url={SPOTIFY_SHOW_URL} icon="musical-notes" />
      </Widget>

      <Widget header="Watch on YouTube">
        <View style={[styles.embed, styles.videoEmbed]}>
          <WebView
            source={{ uri: YOUTUBE_EMBED_URL }}
            style={styles.webview}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
          />
        </View>
        <OpenLink label="Open YouTube Channel" url={YOUTUBE_CHANNEL_URL} icon="logo-youtube" />
      </Widget>

      <Widget header="D14 Magazine Archive">
        <Text style={styles.archiveNote}>
          The D14 Magazine is no longer published — browse past issues below.
        </Text>
        {MAGAZINE_ARCHIVE.map((issue, i) => (
          <Pressable
            key={issue.url}
            style={({ pressed }) => [
              styles.issueRow,
              i < MAGAZINE_ARCHIVE.length - 1 && styles.issueRowBorder,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => WebBrowser.openBrowserAsync(issue.url)}>
            <Ionicons name="book" size={15} color={D14Colors.textTertiary} />
            <Text style={styles.issueLabel}>{issue.label}</Text>
            <Ionicons name="open-outline" size={14} color={D14Colors.textTertiary} />
          </Pressable>
        ))}
      </Widget>
    </ScrollView>
  );
}

function OpenLink({ label, url, icon }: { label: string; url: string; icon: any }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.openLink, pressed && { opacity: 0.8 }]}
      onPress={() => WebBrowser.openBrowserAsync(url)}>
      <Ionicons name={icon} size={15} color={D14Colors.white} />
      <Text style={styles.openLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D14Colors.black },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  title: { color: D14Colors.white, fontSize: 22, fontWeight: '800' },
  subtitle: {
    color: D14Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: Spacing.three,
  },
  embed: {
    height: 352,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: D14Colors.surfaceRaised,
  },
  videoEmbed: { height: 220 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: D14Colors.red,
    borderRadius: Radius.md,
    paddingVertical: 12,
    marginTop: Spacing.two + 4,
  },
  openLinkText: { color: D14Colors.white, fontSize: 13, fontWeight: '700' },
  archiveNote: {
    color: D14Colors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: Spacing.two,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingVertical: 11,
  },
  issueRowBorder: { borderBottomWidth: 1, borderBottomColor: D14Colors.border },
  issueLabel: { color: D14Colors.white, fontSize: 14, flex: 1 },
});
