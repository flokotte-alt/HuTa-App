import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Btn, Card, Chip, H2, Row, Screen, T } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { HANDOVER_LABEL, STATUS_COLOR, STATUS_LABEL, colors } from '@/lib/theme';
import { addDays, dayLabel, iso, mondayOf } from '@/lib/dates';

type Entry = {
  id: string;
  dog_id: string;
  day: string;
  status: string;
  published: boolean;
  station_id: string | null;
  handover_morning: string | null;
  handover_afternoon: string | null;
  dogs: { name: string } | null;
};
type Dog = { id: string; name: string; weekdays: number[] };
type Station = { id: string; label: string };
type Vac = { date_from: string; date_to: string; customers: { name: string; dogs: { name: string; active: boolean }[] } | null };
type Closure = { date_from: string; date_to: string; note: string | null };

const HANDOVERS = ['station', 'apartment', 'self'] as const;

export default function Week() {
  const [monday, setMonday] = useState(mondayOf(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [vacs, setVacs] = useState<Vac[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = iso(monday);
  const to = iso(addDays(monday, 6));

  const load = useCallback(async () => {
    const [e, d, s, v, c] = await Promise.all([
      supabase
        .from('week_entries')
        .select('id, dog_id, day, status, published, station_id, handover_morning, handover_afternoon, dogs(name)')
        .gte('day', from)
        .lte('day', to),
      supabase.from('dogs').select('id, name, weekdays').eq('active', true).order('name'),
      supabase.from('stations').select('id, label').eq('archived', false).order('label'),
      supabase.from('vacations').select('date_from, date_to, customers(name, dogs(name, active))').lte('date_from', to).gte('date_to', from),
      supabase.from('closures').select('date_from, date_to, note').lte('date_from', to).gte('date_to', from),
    ]);
    setEntries((e.data as unknown as Entry[]) ?? []);
    setDogs((d.data as Dog[]) ?? []);
    setStations((s.data as Station[]) ?? []);
    setVacs((v.data as unknown as Vac[]) ?? []);
    setClosures((c.data as Closure[]) ?? []);
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
    if (error) notify('Fehler', error.message);
    load();
  }

  async function publish() {
    setBusy(true);
    const { error } = await supabase.rpc('publish_week', { p_from: from, p_to: to });
    setBusy(false);
    if (error) notify('Fehler', error.message);
    else notify('Veröffentlicht', 'Die Kunden sehen diese Woche jetzt und bekommen eine Nachricht.');
    load();
  }

  async function patch(id: string, values: Partial<Entry>) {
    const { error } = await supabase.from('week_entries').update(values).eq('id', id);
    if (error) notify('Fehler', error.message);
    load();
  }

  async function addDog(dogId: string, day: string) {
    await supabase.from('week_entries').upsert({ dog_id: dogId, day, status: 'registered' }, { onConflict: 'dog_id,day' });
    setAdding(null);
    load();
  }

  const unpublished = entries.filter((e) => !e.published).length;
  const sel = entries.find((e) => e.id === selected);

  const handoverRow = (value: string | null, onPick: (v: string | null) => void) => (
    <Row wrap>
      <Chip title="Regel" active={value === null} onPress={() => onPick(null)} />
      {HANDOVERS.map((h) => (
        <Chip key={h} title={HANDOVER_LABEL[h]} active={value === h} onPress={() => onPick(h)} />
      ))}
    </Row>
  );

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
          <T bold>
            {sel.dogs?.name} · {dayLabel(new Date(sel.day + 'T12:00:00'))}
          </T>
          <Row wrap>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <Chip key={k} title={v} active={sel.status === k} onPress={() => patch(sel.id, { status: k })} />
            ))}
          </Row>
          <T small muted>
            Station nur für diesen Tag
          </T>
          <Row wrap>
            <Chip title="Regel" active={sel.station_id === null} onPress={() => patch(sel.id, { station_id: null })} />
            {stations.map((s) => (
              <Chip key={s.id} title={s.label} active={sel.station_id === s.id} onPress={() => patch(sel.id, { station_id: s.id })} />
            ))}
          </Row>
          <T small muted>
            Übergabe morgens
          </T>
          {handoverRow(sel.handover_morning, (v) => patch(sel.id, { handover_morning: v }))}
          <T small muted>
            Übergabe nachmittags
          </T>
          {handoverRow(sel.handover_afternoon, (v) => patch(sel.id, { handover_afternoon: v }))}
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
        const closed = closures.find((c) => c.date_from <= day && c.date_to >= day);
        const onVacation = vacs
          .filter((v) => v.date_from <= day && v.date_to >= day)
          .flatMap((v) => (v.customers?.dogs ?? []).filter((x) => x.active).map((x) => x.name));
        return (
          <Card key={day}>
            <H2>{dayLabel(d)}</H2>
            {closed && <T bold color={colors.red}>Huta geschlossen{closed.note ? `: ${closed.note}` : ''}</T>}
            {onVacation.length > 0 && <T small muted>Urlaub (Info der Kunden): {onVacation.join(', ')}</T>}
            <Row wrap>
              {list.map((e) => {
                const marks = [
                  e.status !== 'registered' ? STATUS_LABEL[e.status] : '',
                  e.station_id ? 'andere Station' : '',
                  e.handover_morning || e.handover_afternoon ? 'Übergabe geändert' : '',
                ].filter(Boolean);
                return (
                  <Chip
                    key={e.id}
                    title={`${e.dogs?.name}${marks.length ? ' · ' + marks.join(', ') : ''}${e.published ? '' : ' *'}`}
                    active={selected === e.id}
                    onPress={() => setSelected(selected === e.id ? null : e.id)}
                  />
                );
              })}
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
        * = noch nicht veröffentlicht. Änderungen nach dem Veröffentlichen sind sofort bei den Kunden sichtbar und lösen eine Nachricht aus.
      </T>
    </Screen>
  );
}
