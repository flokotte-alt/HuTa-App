// Dateien eines Kunden, vor allem Vertraege. Privater Speicher, nur Dienstleister haben Zugriff.
import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { Btn, Card, Grow, H2, IconBtn, Row, T } from './ui';
import { fullDateLabel } from '@/lib/dates';
import { confirmDialog, notify } from '@/lib/dialog';
import { openStored, randomName, readFile, safeFileName, sizeLabel } from '@/lib/files';
import { supabase } from '@/lib/supabase';

type Doc = { id: string; path: string; name: string; size: number | null; uploaded_at: string };

const MAX = 20 * 1024 * 1024;

export function CustomerFiles({ customerId }: { customerId: string }) {
  const [files, setFiles] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('customer_files').select('*').eq('customer_id', customerId).order('uploaded_at', { ascending: false });
    setFiles((data as Doc[]) ?? []);
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function upload() {
    const pick = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (pick.canceled) return;
    const asset = pick.assets[0];
    if ((asset.size ?? 0) > MAX) return notify('Datei zu groß', `Erlaubt sind höchstens ${sizeLabel(MAX)}.`);
    setBusy(true);
    try {
      const data = await readFile(asset.uri);
      const path = `${customerId}/${randomName()}-${safeFileName(asset.name)}`;
      const up = await supabase.storage.from('contracts').upload(path, data, { contentType: asset.mimeType ?? 'application/octet-stream' });
      if (up.error) throw up.error;
      const { error } = await supabase
        .from('customer_files')
        .insert({ customer_id: customerId, path, name: asset.name, size: asset.size ?? data.byteLength, mime: asset.mimeType ?? null });
      if (error) {
        await supabase.storage.from('contracts').remove([path]);
        throw error;
      }
      await load();
    } catch (e) {
      notify('Hochladen nicht möglich', e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setBusy(false);
    }
  }

  async function remove(doc: Doc) {
    const rm = await supabase.storage.from('contracts').remove([doc.path]);
    if (rm.error) return notify('Fehler', rm.error.message);
    await supabase.from('customer_files').delete().eq('id', doc.id);
    load();
  }

  return (
    <>
      <H2>Dateien und Verträge</H2>
      {files.length === 0 && <T muted>Noch keine Datei.</T>}
      {files.map((f) => (
        <Card key={f.id}>
          <Row>
            <Grow>
              <T bold>{f.name}</T>
              <T small muted>
                {fullDateLabel(new Date(f.uploaded_at))}
                {f.size ? `, ${sizeLabel(f.size)}` : ''}
              </T>
            </Grow>
            <IconBtn
              icon="open-outline"
              label={`${f.name} öffnen`}
              onPress={() => openStored('contracts', f.path).catch((e) => notify('Öffnen nicht möglich', e.message))}
            />
            <IconBtn
              icon="trash-outline"
              label={`${f.name} löschen`}
              onPress={() => confirmDialog('Datei löschen?', `${f.name} wird endgültig gelöscht.`, 'Löschen', () => remove(f), true)}
            />
          </Row>
        </Card>
      ))}
      <Btn kind="secondary" title="Datei hochladen" icon="attach" onPress={upload} busy={busy} />
    </>
  );
}
