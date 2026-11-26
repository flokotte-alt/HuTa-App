// Album: Fotos und Videos hochladen, ansehen, speichern. Die Dateien liegen in einem privaten Speicher.
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { randomName, readFile, sizeLabel } from './files';
import { supabase } from './supabase';

export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MAX_VIDEO = 50 * 1024 * 1024; // Obergrenze des Speichers im aktuellen Tarif
const MAX_PHOTO_SIDE = 2560;

export type AlbumItem = {
  id: string;
  path: string;
  kind: 'photo' | 'video';
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  uploaded_at: string;
  expires_at: string;
};
export type Reaction = { item_id: string; emoji: string; total: number; mine: boolean; names: string[] | null };

export const pickMedia = () =>
  ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 20,
    quality: 0.9,
    // iPhone: Videos moderat auf Full HD verkleinern
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

async function prepare(asset: ImagePicker.ImagePickerAsset) {
  if (asset.type === 'video') {
    const mime = asset.mimeType ?? 'video/mp4';
    const ext = mime === 'video/quicktime' ? 'mov' : mime === 'video/webm' ? 'webm' : 'mp4';
    return { uri: asset.uri, kind: 'video' as const, mime, ext, width: asset.width, height: asset.height };
  }
  // Fotos in guter Qualitaet, aber nicht groesser als noetig
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_PHOTO_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.88, format: SaveFormat.JPEG });
  return { uri: saved.uri, kind: 'photo' as const, mime: 'image/jpeg', ext: 'jpg', width: saved.width, height: saved.height };
}

export async function uploadMedia(asset: ImagePicker.ImagePickerAsset) {
  if (asset.type === 'video' && (asset.fileSize ?? 0) > MAX_VIDEO) {
    throw new Error(`Ein Video ist ${sizeLabel(asset.fileSize)} groß, erlaubt sind ${sizeLabel(MAX_VIDEO)}. Bitte kürzen.`);
  }
  const file = await prepare(asset);
  const data = await readFile(file.uri);
  if (data.byteLength > MAX_VIDEO) throw new Error(`Eine Datei ist größer als ${sizeLabel(MAX_VIDEO)}. Bitte das Video kürzen.`);
  const path = `${randomName()}.${file.ext}`;
  const up = await supabase.storage.from('album').upload(path, data, { contentType: file.mime });
  if (up.error) throw up.error;
  const { error } = await supabase.from('album_items').insert({
    path,
    kind: file.kind,
    width: file.width || null,
    height: file.height || null,
    duration_seconds: asset.duration ? Math.round(asset.duration / 1000) : null,
    size: data.byteLength,
  });
  if (error) {
    await supabase.storage.from('album').remove([path]);
    throw error;
  }
}

export async function removeMedia(item: AlbumItem) {
  const rm = await supabase.storage.from('album').remove([item.path]);
  if (rm.error) throw rm.error;
  const { error } = await supabase.from('album_items').delete().eq('id', item.id);
  if (error) throw error;
}

// Auf das Handy speichern (in der Web-Vorschau: herunterladen)
export async function saveToDevice(item: AlbumItem): Promise<string> {
  const name = `huta-${item.path}`;
  const { data, error } = await supabase.storage.from('album').createSignedUrl(item.path, 300, { download: name });
  if (error || !data) throw error ?? new Error('Datei nicht gefunden');
  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = name;
    link.click();
    return 'Der Download wurde gestartet.';
  }
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) throw new Error('Bitte erlaube in den Einstellungen deines Handys das Speichern von Fotos.');
  const file = await File.downloadFileAsync(data.signedUrl, new File(Paths.cache, name), { idempotent: true });
  try {
    await MediaLibrary.saveToLibraryAsync(file.uri);
  } finally {
    try {
      file.delete();
    } catch {
      /* Zwischenspeicher raeumt das System selbst auf */
    }
  }
  return item.kind === 'video' ? 'Das Video liegt jetzt bei deinen Fotos.' : 'Das Foto liegt jetzt bei deinen Fotos.';
}
