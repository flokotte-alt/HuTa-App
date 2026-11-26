// Album fuer beide Rollen. Dienstleister laden hoch und loeschen, Kunden sehen, speichern und reagieren.
import { useCallback, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Btn, H1, IconBtn, Row, Screen, Sheet, Spinner, T } from './ui';
import { useAuth } from '@/lib/auth';
import { EMOJIS, pickMedia, removeMedia, saveToDevice, uploadMedia, type AlbumItem, type Reaction } from '@/lib/album';
import { dayLabel, timeLabel } from '@/lib/dates';
import { confirmDialog, notify } from '@/lib/dialog';
import { useLive } from '@/lib/live';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Data = { items: AlbumItem[]; urls: Record<string, string>; reactions: Reaction[] };

// Signierte Links merken, damit Bilder nicht bei jedem Aktualisieren neu geladen werden
const linkCache = new Map<string, { url: string; until: number }>();

async function signedUrls(paths: string[]) {
  const missing = paths.filter((p) => (linkCache.get(p)?.until ?? 0) < Date.now());
  if (missing.length) {
    const { data } = await supabase.storage.from('album').createSignedUrls(missing, 6 * 3600);
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) linkCache.set(d.path, { url: d.signedUrl, until: Date.now() + 5 * 3600_000 });
    }
  }
  return Object.fromEntries(paths.map((p) => [p, linkCache.get(p)?.url ?? '']));
}

export function AlbumScreen() {
  const { profile } = useAuth();
  const provider = profile?.role === 'provider';
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<Data | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reacting, setReacting] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const load = useCallback(async () => {
    const [i, r] = await Promise.all([
      supabase.from('album_items').select('*').gt('expires_at', new Date().toISOString()).order('uploaded_at', { ascending: false }),
      supabase.rpc('album_reaction_summary'),
    ]);
    if (i.error) return;
    const items = i.data as AlbumItem[];
    const urls = await signedUrls(items.map((x) => x.path));
    setData({ items, urls, reactions: (r.data as Reaction[]) ?? [] });
  }, []);

  const live = useLive(load, ['album_items', 'app_settings'], 30000);

  async function upload() {
    const pick = await pickMedia();
    if (pick.canceled) return;
    const failed: string[] = [];
    for (let n = 0; n < pick.assets.length; n++) {
      setProgress(`Datei ${n + 1} von ${pick.assets.length} wird hochgeladen. Bitte die App geöffnet lassen.`);
      try {
        await uploadMedia(pick.assets[n]);
      } catch (e) {
        failed.push(e instanceof Error ? e.message : ((e as { message?: string }).message ?? 'Unbekannter Fehler'));
      }
      await load();
    }
    setProgress('');
    if (failed.length) notify(`${failed.length} nicht hochgeladen`, failed.join('\n'));
  }

  async function react(itemId: string, emoji: string) {
    setReacting(null);
    const mine = data?.reactions.find((r) => r.item_id === itemId && r.mine);
    const { data: me } = await supabase.from('customers').select('id').maybeSingle();
    if (!me) return;
    // Gleiches Emoji noch einmal: zuruecknehmen
    const { error } =
      mine?.emoji === emoji
        ? await supabase.from('album_reactions').delete().eq('item_id', itemId).eq('customer_id', me.id)
        : await supabase.from('album_reactions').upsert({ item_id: itemId, customer_id: me.id, emoji }, { onConflict: 'item_id,customer_id' });
    if (error) notify('Reaktion nicht möglich', error.message);
    load();
  }

  if (!data) return <Spinner />;
  const columns = width > 600 ? 4 : 3;
  const tile = (Math.min(width, 720) - 32 - (columns - 1) * 6) / columns;
  const open = data.items.find((x) => x.id === openId) ?? null;

  return (
    <Screen safeTop onRefresh={live.onRefresh} refreshing={live.refreshing}>
      <H1>Album</H1>
      {provider && <Btn title="Fotos und Videos hochladen" icon="cloud-upload-outline" onPress={upload} busy={!!progress} />}
      {progress ? <T muted>{progress}</T> : null}
      {data.items.length === 0 ? (
        <T muted>Zurzeit sind keine Fotos oder Videos da.</T>
      ) : (
        <T small muted>
          {provider ? 'Alles wird nach Ablauf der Frist automatisch gelöscht.' : 'Gedrückt halten zum Reagieren. Alles wird nach kurzer Zeit gelöscht.'}
        </T>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {data.items.map((item) => {
          const reactions = data.reactions.filter((r) => r.item_id === item.id);
          return (
            <View key={item.id} style={{ width: tile }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.kind === 'video' ? 'Video' : 'Foto'} vom ${dayLabel(new Date(item.uploaded_at))} öffnen`}
                onPress={() => setOpenId(item.id)}
                onLongPress={provider ? undefined : () => setReacting(item.id)}
                style={({ pressed }) => ({
                  width: tile,
                  height: tile,
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {item.kind === 'photo' ? (
                  <Image
                    source={{ uri: data.urls[item.path], cacheKey: item.path }}
                    style={{ width: tile, height: tile }}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={40} color={colors.primary} />
                    <T small muted>
                      Video
                      {item.duration_seconds ? ` ${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, '0')}` : ''}
                    </T>
                  </>
                )}
              </Pressable>
              {reactions.length > 0 && (
                <Text style={{ fontSize: 13, color: colors.text, paddingTop: 2 }}>
                  {reactions.map((r) => `${r.emoji} ${r.total}`).join('  ')}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {open && (
        <Viewer
          item={open}
          url={data.urls[open.path]}
          reactions={data.reactions.filter((r) => r.item_id === open.id)}
          provider={provider}
          onReact={() => setReacting(open.id)}
          onClose={() => setOpenId(null)}
          onDelete={() =>
            confirmDialog('Wirklich löschen?', 'Die Datei verschwindet für alle.', 'Löschen', async () => {
              try {
                await removeMedia(open);
                setOpenId(null);
              } catch (e) {
                notify('Löschen nicht möglich', (e as { message?: string }).message);
              }
              load();
            }, true)
          }
          picker={reacting === open.id ? <EmojiRow onPick={(e) => react(open.id, e)} /> : null}
        />
      )}

      <Sheet visible={!!reacting && !open} onClose={() => setReacting(null)} title="Reagieren">
        <EmojiRow onPick={(e) => reacting && react(reacting, e)} />
      </Sheet>
    </Screen>
  );
}

function EmojiRow({ onPick }: { onPick: (emoji: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', backgroundColor: colors.card, borderRadius: 30, padding: 6 }}>
      {EMOJIS.map((e) => (
        <Pressable key={e} accessibilityRole="button" accessibilityLabel={`Mit ${e} reagieren`} onPress={() => onPick(e)} style={{ padding: 8 }}>
          <Text style={{ fontSize: 28 }}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function VideoPlayerBox({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls />;
}

function Viewer({
  item,
  url,
  reactions,
  provider,
  onReact,
  onClose,
  onDelete,
  picker,
}: {
  item: AlbumItem;
  url: string;
  reactions: Reaction[];
  provider: boolean;
  onReact: () => void;
  onClose: () => void;
  onDelete: () => void;
  picker: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      notify('Gespeichert', await saveToDevice(item));
    } catch (e) {
      notify('Speichern nicht möglich', (e as { message?: string }).message);
    }
    setSaving(false);
  }

  const expires = new Date(item.expires_at);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
            <IconBtn icon="close" label="Schließen" onPress={onClose} />
            <View style={{ flex: 1 }}>
              <T small muted center>
                Wird am {dayLabel(expires)} um {timeLabel(expires)} Uhr gelöscht
              </T>
            </View>
            {provider ? <IconBtn icon="trash-outline" label="Löschen" onPress={onDelete} /> : <View style={{ width: 44 }} />}
          </View>
          <View style={{ flex: 1 }}>
            {item.kind === 'video' ? (
              <VideoPlayerBox url={url} />
            ) : (
              <Pressable style={{ flex: 1 }} onLongPress={provider ? undefined : onReact} accessibilityLabel="Foto">
                <Image source={{ uri: url, cacheKey: item.path }} style={{ flex: 1 }} contentFit="contain" />
              </Pressable>
            )}
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            {picker}
            {reactions.length > 0 && (
              <Row wrap>
                {reactions.map((r) => (
                  <View
                    key={r.emoji}
                    style={{ backgroundColor: r.mine ? colors.primarySoft : colors.card, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 }}
                  >
                    <T>
                      {r.emoji} {r.total}
                    </T>
                  </View>
                ))}
              </Row>
            )}
            {provider &&
              reactions.map((r) => (
                <T key={`n${r.emoji}`} small muted>
                  {r.emoji} {r.names?.join(', ')}
                </T>
              ))}
            <Row>
              {!provider && (
                <View style={{ flex: 1 }}>
                  <Btn kind="secondary" title="Reagieren" icon="happy-outline" onPress={onReact} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Btn title="Herunterladen" icon="download-outline" onPress={save} busy={saving} />
              </View>
            </Row>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
