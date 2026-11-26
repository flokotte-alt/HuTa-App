// Feste Regeln eines Hundes. Nur hier aendern sich die Regeln, die Wochentabelle gilt immer fuer einzelne Tage.
import { useEffect, useState } from 'react';
import { notify, confirmDialog } from '@/lib/dialog';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, Card, Chip, Field, H2, Row, Screen, Spinner, SwitchRow, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { HANDOVER_LABEL, PERIOD_LABEL } from '@/lib/theme';

type Station = { id: string; label: string };
type Rule = { handover: 'station' | 'apartment' | 'self'; station_id: string | null };
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

export default function DogScreen() {
  const { id, customer } = useLocalSearchParams<{ id?: string; customer?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(!!id);
  const [customerId, setCustomerId] = useState<string | null>(customer ?? null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [apartmentButton, setApartmentButton] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [bufferOn, setBufferOn] = useState(true);
  const [buffer, setBuffer] = useState('');
  const [standard, setStandard] = useState('5');
  const [active, setActive] = useState(true);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [morning, setMorning] = useState<Rule>({ handover: 'station', station_id: null });
  const [afternoon, setAfternoon] = useState<Rule>({ handover: 'station', station_id: null });
  const [stations, setStations] = useState<Station[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, set] = await Promise.all([
        supabase.from('stations').select('id, label').eq('archived', false).order('label'),
        supabase.from('app_settings').select('value').eq('key', 'apartment_extra_minutes').maybeSingle(),
      ]);
      setStations((s.data as Station[]) ?? []);
      if (set.data) setStandard(set.data.value);
      if (!id) return;
      const { data: d } = await supabase.from('dogs').select('*').eq('id', id).maybeSingle();
      if (d) {
        setCustomerId(d.customer_id);
        setName(d.name);
        setAddress(d.address ?? '');
        setNotes(d.notes ?? '');
        setApartmentButton(d.apartment_allowed);
        setHasKey(d.has_key);
        setBufferOn(d.apartment_buffer_enabled);
        setBuffer(d.apartment_buffer_minutes == null ? '' : String(d.apartment_buffer_minutes));
        setActive(d.active);
        setWeekdays(d.weekdays ?? []);
      }
      const { data: rules } = await supabase.from('dog_rules').select('*').eq('dog_id', id);
      for (const r of rules ?? []) {
        const v: Rule = { handover: r.handover, station_id: r.station_id };
        if (r.period === 'morning') setMorning(v);
        else setAfternoon(v);
      }
      setLoading(false);
    })();
  }, [id]);

  async function save() {
    if (!customerId) return;
    const minutes = buffer.trim() === '' ? null : Number(buffer);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 120)) {
      return notify('Wohnungs-Puffer prüfen', 'Bitte eine Zahl von 0 bis 120 Minuten eingeben oder das Feld leer lassen.');
    }
    setBusy(true);
    const payload = {
      customer_id: customerId,
      name: name.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      apartment_allowed: apartmentButton,
      has_key: hasKey,
      apartment_buffer_enabled: bufferOn,
      apartment_buffer_minutes: minutes,
      active,
      weekdays: [...weekdays].sort(),
    };
    const result = id
      ? await supabase.from('dogs').update(payload).eq('id', id).select('id').single()
      : await supabase.from('dogs').insert(payload).select('id').single();
    if (result.error || !result.data) {
      setBusy(false);
      return notify('Fehler', result.error?.message ?? 'Unbekannter Fehler');
    }
    const rules = (['morning', 'afternoon'] as const).map((period) => {
      const r = period === 'morning' ? morning : afternoon;
      return { dog_id: result.data.id, period, handover: r.handover, station_id: r.handover === 'self' ? null : r.station_id };
    });
    const { error } = await supabase.from('dog_rules').upsert(rules, { onConflict: 'dog_id,period' });
    setBusy(false);
    if (error) return notify('Fehler', error.message);
    router.back();
  }

  const ruleEditor = (period: 'morning' | 'afternoon', rule: Rule, set: (r: Rule) => void) => (
    <Card>
      <H2>{PERIOD_LABEL[period]}</H2>
      <T small muted>
        Übergabe
      </T>
      <Row wrap>
        {(['station', 'apartment', 'self'] as const).map((h) => (
          <Chip key={h} title={HANDOVER_LABEL[h]} active={rule.handover === h} onPress={() => set({ ...rule, handover: h })} />
        ))}
      </Row>
      {rule.handover !== 'self' && (
        <>
          <T small muted>
            Abholstation
          </T>
          <Row wrap>
            {stations.map((s) => (
              <Chip
                key={s.id}
                title={s.label}
                active={rule.station_id === s.id}
                onPress={() => set({ ...rule, station_id: rule.station_id === s.id ? null : s.id })}
              />
            ))}
          </Row>
          {!rule.station_id && (
            <T small muted>
              Ohne Station erscheint der Hund nicht in der Route.
            </T>
          )}
        </>
      )}
    </Card>
  );

  if (loading) return <Spinner />;

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? name || 'Hund' : 'Neuer Hund' }} />
      <Field label="Name des Hundes" value={name} onChangeText={setName} autoCapitalize="words" />
      <H2>Feste Wochentage</H2>
      <Row wrap>
        {WD.map((w, i) => (
          <Chip
            key={w}
            title={w}
            active={weekdays.includes(i + 1)}
            onPress={() => setWeekdays(weekdays.includes(i + 1) ? weekdays.filter((x) => x !== i + 1) : [...weekdays, i + 1])}
          />
        ))}
      </Row>
      {ruleEditor('morning', morning, (r) => {
        setMorning(r);
        // Meist ist nachmittags dieselbe Station: vorbelegen, solange dort noch nichts gewaehlt ist
        if (r.station_id && !afternoon.station_id) setAfternoon({ ...afternoon, station_id: r.station_id });
      })}
      {ruleEditor('afternoon', afternoon, setAfternoon)}
      <Card>
        <SwitchRow
          label={'Wohnungs-Button anzeigen'}
          hint="Während der Fahrt: Bitte in die Wohnung bringen (morgens: abholen)."
          value={apartmentButton}
          onChange={setApartmentButton}
        />
        <SwitchRow label="Wir haben einen Schlüssel" value={hasKey} onChange={setHasKey} />
        <SwitchRow label="Wohnungs-Puffer zählt" hint="Zeit für Parkplatz, Wohnung und zurück zum Auto." value={bufferOn} onChange={setBufferOn} />
        {bufferOn && (
          <Field
            label={`Puffer in Minuten (leer = Standard, ${standard} Minuten)`}
            value={buffer}
            onChangeText={setBuffer}
            keyboardType="number-pad"
            placeholder={standard}
          />
        )}
      </Card>
      <Field label="Adresse (nur für Dienstleister sichtbar)" value={address} onChangeText={setAddress} />
      <Field label="Notizen (nur für Dienstleister)" value={notes} onChangeText={setNotes} multiline />
      {id && (
        <Card>
          <SwitchRow label="Hund ist aktiv" hint="Ausgeschaltet erscheint er in keiner Liste mehr." value={active} onChange={setActive} />
        </Card>
      )}
      <Btn title="Speichern" onPress={save} busy={busy} disabled={!name.trim()} />
      <Btn kind="ghost" title="Abbrechen" onPress={() => router.back()} />
      {id && (
        <Btn
          kind="ghost"
          title="Hund löschen"
          onPress={() =>
            confirmDialog(`${name} endgültig löschen?`, 'Der Hund und sein Wochenplan werden gelöscht.', 'Endgültig löschen', async () => {
              const { error } = await supabase.from('dogs').delete().eq('id', id);
              if (error) return notify('Fehler', error.message);
              router.back();
            }, true)
          }
        />
      )}
    </Screen>
  );
}
