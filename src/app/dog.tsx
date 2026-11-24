import { useEffect, useState } from 'react';
import { notify } from '@/lib/dialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, Card, Chip, Field, H2, Row, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { HANDOVER_LABEL } from '@/lib/theme';

type Station = { id: string; label: string; archived: boolean };
type Rule = { handover: 'station' | 'apartment' | 'self'; station_id: string | null };
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function DogForm() {
  const { id, customer } = useLocalSearchParams<{ id?: string; customer?: string }>();
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(customer ?? null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [apt, setApt] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [morning, setMorning] = useState<Rule>({ handover: 'station', station_id: null });
  const [afternoon, setAfternoon] = useState<Rule>({ handover: 'station', station_id: null });
  const [stations, setStations] = useState<Station[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await supabase.from('stations').select('id, label, archived').eq('archived', false).order('label');
      setStations((s.data as Station[]) ?? []);
      if (!id) return;
      const { data: d } = await supabase.from('dogs').select('*').eq('id', id).maybeSingle();
      if (d) {
        setCustomerId(d.customer_id);
        setName(d.name);
        setAddress(d.address ?? '');
        setNotes(d.notes ?? '');
        setApt(d.apartment_allowed);
        setWeekdays(d.weekdays ?? []);
      }
      const { data: rules } = await supabase.from('dog_rules').select('*').eq('dog_id', id);
      for (const r of rules ?? []) {
        const v: Rule = { handover: r.handover, station_id: r.station_id };
        if (r.period === 'morning') setMorning(v);
        else setAfternoon(v);
      }
    })();
  }, [id]);

  async function save() {
    if (!customerId) return;
    setBusy(true);
    const payload = {
      customer_id: customerId,
      name: name.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      apartment_allowed: apt,
      weekdays,
    };
    let dogId = id;
    if (id) {
      const { error } = await supabase.from('dogs').update(payload).eq('id', id);
      if (error) {
        setBusy(false);
        return notify('Fehler', error.message);
      }
    } else {
      const { data, error } = await supabase.from('dogs').insert(payload).select('id').single();
      if (error || !data) {
        setBusy(false);
        return notify('Fehler', error?.message ?? 'Unbekannt');
      }
      dogId = data.id;
    }
    const rules = [
      { dog_id: dogId, period: 'morning', handover: morning.handover, station_id: morning.handover === 'self' ? null : morning.station_id },
      { dog_id: dogId, period: 'afternoon', handover: afternoon.handover, station_id: afternoon.handover === 'self' ? null : afternoon.station_id },
    ];
    const { error } = await supabase.from('dog_rules').upsert(rules, { onConflict: 'dog_id,period' });
    setBusy(false);
    if (error) return notify('Fehler', error.message);
    router.back();
  }

  const ruleEditor = (title: string, rule: Rule, set: (r: Rule) => void) => (
    <Card>
      <H2>{title}</H2>
      <Row wrap>
        {(['station', 'apartment', 'self'] as const).map((h) => (
          <Chip key={h} title={HANDOVER_LABEL[h]} active={rule.handover === h} onPress={() => set({ ...rule, handover: h })} />
        ))}
      </Row>
      {rule.handover !== 'self' && (
        <>
          <T small muted>
            Standardstation
          </T>
          <Row wrap>
            {stations.map((s) => (
              <Chip key={s.id} title={s.label} active={rule.station_id === s.id} onPress={() => set({ ...rule, station_id: s.id })} />
            ))}
          </Row>
        </>
      )}
    </Card>
  );

  return (
    <Screen>
      <Field label="Name des Hundes" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Adresse (nur für Dienstleister sichtbar)" value={address} onChangeText={setAddress} />
      <Field label="Notizen (nur für Dienstleister)" value={notes} onChangeText={setNotes} multiline />
      <H2>Feste Tage</H2>
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
      <Row>
        <Chip title={apt ? 'Wohnungs-Knopf: erlaubt' : 'Wohnungs-Knopf: aus'} active={apt} onPress={() => setApt(!apt)} />
      </Row>
      {ruleEditor('Morgens', morning, setMorning)}
      {ruleEditor('Nachmittags', afternoon, setAfternoon)}
      <Btn title="Speichern" onPress={save} busy={busy} disabled={!name.trim()} />
      {id && (
        <Btn
          kind="ghost"
          title="Hund archivieren"
          onPress={async () => {
            await supabase.from('dogs').update({ active: false }).eq('id', id);
            router.back();
          }}
        />
      )}
      <Btn kind="ghost" title="Abbrechen" onPress={() => router.back()} />
    </Screen>
  );
}
