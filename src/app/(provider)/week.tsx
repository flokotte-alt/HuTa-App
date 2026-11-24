import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Btn, Card, Chip, H2, Row, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATUS_COLOR, STATUS_LABEL, colors } from '@/lib/theme';
import { addDays, dayLabel, iso, mondayOf } from '@/lib/dates';

type Entry = { id: string; dog_id: string; day: string; status: string; published: boolean; dogs: { name: string } | null };
type Dog = { id: string; name: string; weekdays: number[] };

export default function Week() {
  const [monday, setMonday] = useState(mondayOf(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = iso(monday);
  const to = iso(addDays(monday, 6));

  const load = useCallback(async () => {
    const [e, d] = await Promise.all([
      supabase.from('week_entries').select('id, dog_id, day, status, published, dogs(name)').gte('day', from).lte('day', to),
      supabase.from('dogs').select('id, name, weekdays').eq('active', true).order('name'),
    ]);
    setEntries((e.data as unknown as Entry[]) ?? []);
    setDogs((d.data as Dog[]) ?? []);
  }, [from, to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function prefill() {
    setBusy(true);
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i);
      const iw = ((day.getDay() + 6) % 7) + 1;
      for (const d of dogs) if (d.weekdays.includes(iw)) rows.push({ dog_id: d.id, day: iso(day), status: 'registered' });
    }
    const { error } = await supabase.from('week_entries').upsert(rows, { onConflict: 'dog_id,day', ignoreDuplicates: true });
    setBusy(false);
    if (error) Alert.alert('Fehler', error.message);
    load();
  }

  async function publish() {
    setBusy(true);
    const { error } = await supabase.from('week_entries').update({ published: true }).gte('day', from).lte('day', to);
    setBusy(false);
    if (error) Alert.alert('Fehler', error.message);
    else Alert.alert('Veröffentlicht', 'Die Kunden sehen diese Woche jetzt. (Push-Nachricht folgt in einer späteren Version.)');
    load();
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('week_entries').update({ status }).eq('id', id);
    load();
  }

  async function addDog(dogId: string, day: string) {
    await supabase.from('week_entries').upsert({ dog_id: dogId, day, status: 'registered' }, { onConflict: 'dog_id,day' });
    setAdding(null);
    load();
  }

  const unpublished = entries.filter((e) => !e.published).length;
  const sel = entries.find((e) => e.id === selected);

  return (
    <Screen>
      <Row>
        <Btn kind="ghost" title="◀" onPress={() => setMonday(addDays(monday, -7))} />
        <T bold>
          {dayLabel(monday)} bis {dayLabel(addDays(monday, 6))}
        </T>
        <Btn kind="ghost" title="▶" onPress={() => setMonday(addDays(monday, 7))} />
      </Row>
      <Row>
        <Btn kind="dark" title="Aus festen Tagen füllen" onPress={prefill} busy={busy} />
        <Btn title={unpublished ? `Veröffentlichen (${unpublished})` : 'Veröffentlicht'} onPress={publish} disabled={!unpublished} />
      </Row>

      {sel && (
        <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
          <T bold>{sel.dogs?.name}</T>
          <Row wrap>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <Chip key={k} title={v} active={sel.status === k} onPress={() => setStatus(sel.id, k)} />
            ))}
          </Row>
          <Btn
            kind="ghost"
            title="Aus dem Tag entfernen"
            onPress={async () => {
              await supabase.from('week_entries').delete().eq('id', sel.id);
              setSelected(null);
              load();
            }}
          />
        </Card>
      )}

      {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => {
        const day = iso(d);
        const list = entries.filter((e) => e.day === day).sort((a, b) => (a.dogs?.name ?? '').localeCompare(b.dogs?.name ?? ''));
        const missing = dogs.filter((dg) => !list.some((e) => e.dog_id === dg.id));
        return (
          <Card key={day}>
            <H2>{dayLabel(d)}</H2>
            <Row wrap>
              {list.map((e) => (
                <Chip
                  key={e.id}
                  title={`${e.dogs?.name}${e.status !== 'registered' ? ' · ' + STATUS_LABEL[e.status] : ''}${e.published ? '' : ' *'}`}
                  active={selected === e.id}
                  onPress={() => setSelected(selected === e.id ? null : e.id)}
                />
              ))}
              {list.length === 0 && <T muted>Niemand angemeldet.</T>}
            </Row>
            {list.some((e) => STATUS_COLOR[e.status] === colors.red) && <T small color={colors.red}>Rot = Absage mit Berechnung</T>}
            <Chip title={adding === day ? 'Schließen' : '+ Hund'} onPress={() => setAdding(adding === day ? null : day)} />
            {adding === day && (
              <Row wrap>
                {missing.map((dg) => (
                  <Chip key={dg.id} title={dg.name} onPress={() => addDog(dg.id, day)} />
                ))}
              </Row>
            )}
          </Card>
        );
      })}
      <T small muted>
        * = noch nicht veröffentlicht. Änderungen am Status sind sofort bei den Kunden sichtbar.
      </T>
    </Screen>
  );
}
