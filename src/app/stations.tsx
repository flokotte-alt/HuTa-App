// Stationen: Abholstationen sowie Start- und Zielpunkte der Fahrten
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Badge, Btn, Card, Divider, Field, Grow, H2, IconBtn, Row, Screen, Sheet, Spinner, SwitchRow, T } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

type Station = { id: string; label: string; address: string; lat: number; lng: number; archived: boolean; is_start: boolean; is_end: boolean };
type Form = { id: string | null; label: string; address: string; lat: string; lng: string; is_start: boolean; is_end: boolean; archived: boolean };

const empty: Form = { id: null, label: '', address: '', lat: '', lng: '', is_start: false, is_end: false, archived: false };

export default function Stations() {
  const [list, setList] = useState<Station[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('stations').select('*').order('archived').order('label');
    if (!error) setList(data as Station[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const set = (values: Partial<Form>) => setForm((f) => (f ? { ...f, ...values } : f));

  async function geocode() {
    if (!form) return;
    setBusy('geo');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(form.address)}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'huta-app/0.3' } });
      const found = (await r.json()) as { lat: string; lon: string }[];
      if (!found.length) notify('Nicht gefunden', 'Bitte die Adresse genauer eingeben oder die Koordinaten von Hand eintragen.');
      else set({ lat: found[0].lat, lng: found[0].lon });
    } catch {
      notify('Kein Netz', 'Die Suche hat nicht geklappt.');
    }
    setBusy('');
  }

  async function save() {
    if (!form) return;
    const lat = Number(form.lat.replace(',', '.'));
    const lng = Number(form.lng.replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
      return notify('Koordinaten prüfen', 'Bitte "Koordinaten suchen" tippen oder gültige Werte eintragen.');
    }
    setBusy('save');
    const values = {
      label: form.label.trim() || form.address.trim(),
      address: form.address.trim(),
      lat,
      lng,
      is_start: form.is_start,
      is_end: form.is_end,
      archived: form.archived,
    };
    const { error } = form.id ? await supabase.from('stations').update(values).eq('id', form.id) : await supabase.from('stations').insert(values);
    setBusy('');
    if (error) return notify('Fehler', error.message);
    setForm(null);
    load();
  }

  async function toggle(id: string, values: Partial<Station>) {
    setList((l) => l?.map((s) => (s.id === id ? { ...s, ...values } : s)) ?? l);
    const { error } = await supabase.from('stations').update(values).eq('id', id);
    if (error) notify('Fehler', error.message);
    load();
  }

  if (!list) return <Spinner />;

  return (
    <Screen>
      <Btn title="Neue Station" icon="add" onPress={() => setForm(empty)} />
      {list.map((s) => (
        <Card key={s.id} style={s.archived ? { opacity: 0.6 } : undefined}>
          <Row>
            <Grow>
              <T bold>{s.label}</T>
              <T small muted>
                {s.address}
              </T>
            </Grow>
            {s.archived && <Badge text="archiviert" />}
            <IconBtn
              icon="create-outline"
              label={`${s.label} bearbeiten`}
              onPress={() => setForm({ ...s, lat: String(s.lat), lng: String(s.lng) })}
            />
          </Row>
          {!s.archived && (
            <>
              <Divider />
              <SwitchRow label="Kann Startpunkt sein" value={s.is_start} onChange={(v) => toggle(s.id, { is_start: v })} />
              <SwitchRow label="Kann Zielpunkt sein" value={s.is_end} onChange={(v) => toggle(s.id, { is_end: v })} />
            </>
          )}
        </Card>
      ))}

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'Station bearbeiten' : 'Neue Station'}>
        {form && (
          <>
            <Field label="Bezeichnung" value={form.label} onChangeText={(label) => set({ label })} />
            <Field label="Adresse" value={form.address} onChangeText={(address) => set({ address })} placeholder="Straße und Nummer, Dresden" />
            <Btn kind="secondary" title="Koordinaten suchen" icon="search" onPress={geocode} disabled={!form.address.trim()} busy={busy === 'geo'} />
            <Row>
              <Grow>
                <Field label="Breite" value={form.lat} onChangeText={(lat) => set({ lat })} keyboardType="numbers-and-punctuation" />
              </Grow>
              <Grow>
                <Field label="Länge" value={form.lng} onChangeText={(lng) => set({ lng })} keyboardType="numbers-and-punctuation" />
              </Grow>
            </Row>
            <H2>Verwendung</H2>
            <SwitchRow label="Kann Startpunkt sein" value={form.is_start} onChange={(is_start) => set({ is_start })} />
            <SwitchRow label="Kann Zielpunkt sein" value={form.is_end} onChange={(is_end) => set({ is_end })} />
            {form.id && (
              <SwitchRow label="Archiviert" hint="Nicht mehr auswählbar, bleibt aber gespeichert." value={form.archived} onChange={(archived) => set({ archived })} />
            )}
            <Btn title="Speichern" onPress={save} disabled={!form.address.trim() || !form.lat || !form.lng} busy={busy === 'save'} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
