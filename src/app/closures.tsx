// Schliesszeiten der Hundetagesstaette
import { useCallback, useState } from 'react';
import { DateField } from '@/components/DateField';
import { Btn, Card, Field, Grow, H2, IconBtn, Row, Screen, Spinner, T } from '@/components/ui';
import { iso, rangeLabel } from '@/lib/dates';
import { confirmDialog, notify } from '@/lib/dialog';
import { useLive } from '@/lib/live';
import { supabase } from '@/lib/supabase';

type Closure = { id: string; date_from: string; date_to: string; note: string | null };

export default function Closures() {
  const [list, setList] = useState<Closure[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const today = iso(new Date());

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('closures').select('*').gte('date_to', today).order('date_from');
    if (!error) setList(data as Closure[]);
  }, [today]);

  useLive(load, ['closures']);

  async function add() {
    const end = to || from;
    if (end < from) return notify('Datum prüfen', '"Bis" liegt vor "Von".');
    setBusy(true);
    const { error } = await supabase.from('closures').insert({ date_from: from, date_to: end, note: note.trim() || null });
    setBusy(false);
    if (error) return notify('Fehler', error.message);
    setFrom('');
    setTo('');
    setNote('');
    load();
  }

  if (!list) return <Spinner />;

  return (
    <Screen>
      <T small muted>
        An Schließtagen wird die Wochentabelle nicht vorbefüllt. Kunden sehen vier Wochen vorher einen Hinweis.
      </T>
      {list.length === 0 && <T muted>Keine Schließzeit eingetragen.</T>}
      {list.map((c) => (
        <Card key={c.id}>
          <Row>
            <Grow>
              <T bold>{rangeLabel(c.date_from, c.date_to)}</T>
              {c.note ? (
                <T small muted>
                  {c.note}
                </T>
              ) : null}
            </Grow>
            <IconBtn
              icon="trash-outline"
              label="Schließzeit löschen"
              onPress={() =>
                confirmDialog('Schließzeit löschen?', rangeLabel(c.date_from, c.date_to), 'Löschen', async () => {
                  const { error } = await supabase.from('closures').delete().eq('id', c.id);
                  if (error) notify('Fehler', error.message);
                  load();
                }, true)
              }
            />
          </Row>
        </Card>
      ))}
      <H2>Neue Schließzeit</H2>
      <Card>
        <DateField label="Von" value={from} onChange={setFrom} min={today} />
        <DateField label="Bis (leer = nur ein Tag)" value={to} onChange={setTo} min={from || today} clearable />
        <Field label="Notiz (sehen auch die Kunden)" value={note} onChangeText={setNote} />
        <Btn title="Eintragen" onPress={add} disabled={!from} busy={busy} />
      </Card>
    </Screen>
  );
}
