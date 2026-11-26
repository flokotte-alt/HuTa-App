// Standardwerte (Tabelle app_settings)
import { useEffect, useState } from 'react';
import { Btn, Card, Field, H2, Screen, Spinner, SwitchRow, T } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

type Num = { key: string; label: string; fallback: number; min: number; max: number };

const GROUPS: { title: string; hint?: string; fields: Num[] }[] = [
  {
    title: 'Wohnung',
    fields: [
      { key: 'apartment_extra_minutes', label: 'Wohnungs-Puffer (Minuten)', fallback: 5, min: 0, max: 60 },
      { key: 'apartment_deadline_minutes', label: 'Wohnungs-Button bis (Minuten vor Ankunft)', fallback: 20, min: 5, max: 60 },
    ],
  },
  {
    title: 'Nachrichten während der Fahrt',
    hint: 'Sie gehen nur an Kunden, die zur Station kommen. Die zweite nur an Kunden, die noch nicht bestätigt haben.',
    fields: [
      { key: 'push_stage1_minutes', label: 'Erste Nachricht (Minuten vor Ankunft)', fallback: 15, min: 6, max: 30 },
      { key: 'push_stage2_minutes', label: 'Dringende Nachricht (Minuten vor Ankunft)', fallback: 5, min: 2, max: 10 },
    ],
  },
  {
    title: 'Strecke während der Fahrt',
    hint: 'Jede Prüfung ist eine Anfrage an Google. Ein größerer Abstand spart Kosten.',
    fields: [
      { key: 'reroute_check_seconds', label: 'Strecke prüfen alle (Sekunden)', fallback: 120, min: 30, max: 900 },
      { key: 'reroute_ask_minutes', label: 'Nachfragen ab (Minuten Ersparnis)', fallback: 1, min: 1, max: 30 },
      { key: 'reroute_auto_minutes', label: 'Automatisch wechseln ab (Minuten Ersparnis)', fallback: 4, min: 1, max: 60 },
    ],
  },
  { title: 'Album', fields: [{ key: 'album_days', label: 'Fotos und Videos löschen nach (Tagen)', fallback: 3, min: 1, max: 60 }] },
];

export default function Defaults() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data, error }) => {
        if (error) return notify('Fehler', error.message);
        setValues(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])));
      });
  }, []);

  if (!values) return <Spinner />;

  async function save() {
    const rows: { key: string; value: string }[] = [];
    for (const f of GROUPS.flatMap((g) => g.fields)) {
      const n = Number(values![f.key] ?? f.fallback);
      if (!Number.isInteger(n) || n < f.min || n > f.max) {
        return notify('Wert prüfen', `${f.label}: bitte eine Zahl von ${f.min} bis ${f.max}.`);
      }
      rows.push({ key: f.key, value: String(n) });
    }
    const num = (k: string) => Number(rows.find((r) => r.key === k)!.value);
    if (num('push_stage2_minutes') >= num('push_stage1_minutes')) return notify('Wert prüfen', 'Die dringende Nachricht muss später kommen als die erste.');
    if (num('reroute_auto_minutes') < num('reroute_ask_minutes')) {
      return notify('Wert prüfen', 'Automatisch wechseln muss mindestens so groß sein wie Nachfragen.');
    }
    rows.push({ key: 'push_trip_started', value: values!.push_trip_started === '1' ? '1' : '0' });
    setBusy(true);
    const { error } = await supabase.from('app_settings').upsert(rows);
    setBusy(false);
    if (error) return notify('Fehler', error.message);
    notify('Gespeichert');
  }

  return (
    <Screen>
      {GROUPS.map((g) => (
        <Card key={g.title}>
          <H2>{g.title}</H2>
          {g.hint ? (
            <T small muted>
              {g.hint}
            </T>
          ) : null}
          {g.fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              value={values[f.key] ?? String(f.fallback)}
              onChangeText={(v) => setValues({ ...values, [f.key]: v })}
              keyboardType="number-pad"
            />
          ))}
          {g.title === 'Nachrichten während der Fahrt' && (
            <SwitchRow
              label="Zusätzlich beim Start der Fahrt"
              hint="Nachricht an alle Kunden der Fahrt, sobald sie startet."
              value={values.push_trip_started === '1'}
              onChange={(v) => setValues({ ...values, push_trip_started: v ? '1' : '0' })}
            />
          )}
        </Card>
      ))}
      <Btn title="Speichern" onPress={save} busy={busy} />
    </Screen>
  );
}
