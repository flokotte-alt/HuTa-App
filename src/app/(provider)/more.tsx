import { useCallback, useState } from 'react';
import { notify } from '@/lib/dialog';
import { useFocusEffect } from 'expo-router';
import { Btn, Card, Chip, Field, H2, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { addDays, dayLabel, iso, rangeLabel } from '@/lib/dates';

type Prov = { id: string; name: string; phone: string | null; email: string | null };
type Duty = { day: string; driver_id: string };
type Closure = { id: string; date_from: string; date_to: string; note: string | null };

export default function More() {
  const { profile, signOut, refresh } = useAuth();
  const [providers, setProviders] = useState<Prov[]>([]);
  const [duty, setDuty] = useState<Duty[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [extra, setExtra] = useState('5');
  const [phone, setPhone] = useState('');
  const [cl, setCl] = useState({ from: '', to: '', note: '' });

  const load = useCallback(async () => {
    const today = iso(new Date());
    const [p, d, c, s] = await Promise.all([
      supabase.from('profiles').select('id, name, phone, email').eq('role', 'provider'),
      supabase.from('duty').select('*').gte('day', today),
      supabase.from('closures').select('*').gte('date_to', today).order('date_from'),
      supabase.from('app_settings').select('value').eq('key', 'apartment_extra_minutes').maybeSingle(),
    ]);
    setProviders((p.data as Prov[]) ?? []);
    setDuty((d.data as Duty[]) ?? []);
    setClosures((c.data as Closure[]) ?? []);
    if (s.data) setExtra(s.data.value);
    setPhone(profile?.phone ?? '');
  }, [profile?.phone]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setDriver(day: string, driverId: string) {
    const { error } = await supabase.from('duty').upsert({ day, driver_id: driverId });
    if (error) notify('Fehler', error.message);
    load();
  }

  async function savePhone() {
    await supabase.from('profiles').update({ phone: phone.trim() || null }).eq('id', profile!.id);
    await refresh();
    notify('Gespeichert');
  }

  async function addClosure() {
    const ok = /^\d{4}-\d{2}-\d{2}$/;
    if (!ok.test(cl.from) || !ok.test(cl.to)) return notify('Datum prüfen', 'Bitte als JJJJ-MM-TT eingeben.');
    const { error } = await supabase.from('closures').insert({ date_from: cl.from, date_to: cl.to, note: cl.note || null });
    if (error) return notify('Fehler', error.message);
    setCl({ from: '', to: '', note: '' });
    load();
  }

  return (
    <Screen>
      <H2>Dienstplan (wer fährt)</H2>
      {providers.length < 2 && (
        <T small muted>
          Es gibt {providers.length} Dienstleister-Konto. Für die Mitarbeiterin muss das Konto serverseitig freigeschaltet werden.
        </T>
      )}
      {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)).map((d) => {
        const day = iso(d);
        const current = duty.find((x) => x.day === day)?.driver_id;
        return (
          <Card key={day}>
            <T bold>{dayLabel(d)}</T>
            <Row wrap>
              {providers.map((p) => (
                <Chip key={p.id} title={p.name || p.email || 'Ohne Namen'} active={current === p.id} onPress={() => setDriver(day, p.id)} />
              ))}
            </Row>
          </Card>
        );
      })}

      <H2>Meine Telefonnummer</H2>
      <Card>
        <Field label="Für den Kontakt-Knopf der Kunden" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Btn title="Speichern" onPress={savePhone} />
      </Card>

      <H2>Schließzeiten der Huta</H2>
      {closures.map((c) => (
        <Row key={c.id}>
          <T>
            {rangeLabel(c.date_from, c.date_to)}
            {c.note ? ` · ${c.note}` : ''}
          </T>
          <Btn
            kind="ghost"
            title="Löschen"
            onPress={async () => {
              await supabase.from('closures').delete().eq('id', c.id);
              load();
            }}
          />
        </Row>
      ))}
      <Card>
        <Field label="Von (JJJJ-MM-TT)" value={cl.from} onChangeText={(v) => setCl({ ...cl, from: v })} autoCapitalize="none" />
        <Field label="Bis (JJJJ-MM-TT)" value={cl.to} onChangeText={(v) => setCl({ ...cl, to: v })} autoCapitalize="none" />
        <Field label="Notiz" value={cl.note} onChangeText={(v) => setCl({ ...cl, note: v })} />
        <Btn title="Eintragen" onPress={addClosure} disabled={!cl.from || !cl.to} />
      </Card>

      <H2>Einstellungen</H2>
      <Card>
        <Field label="Zusatzzeit bei Wohnungs-Übergabe (Minuten)" value={extra} onChangeText={setExtra} keyboardType="number-pad" />
        <Btn
          title="Speichern"
          onPress={async () => {
            await supabase.from('app_settings').upsert({ key: 'apartment_extra_minutes', value: String(Number(extra) || 5) });
            notify('Gespeichert');
          }}
        />
      </Card>

      <T small muted>
        Angemeldet als {profile?.name || profile?.email}
      </T>
      <Btn kind="ghost" title="Abmelden" onPress={signOut} />
    </Screen>
  );
}
