import { useCallback, useState } from 'react';
import { confirmDialog, notify } from '@/lib/dialog';
import { useFocusEffect, useRouter } from 'expo-router';
import { Btn, Card, Field, H2, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { HANDOVER_LABEL } from '@/lib/theme';
import { rangeLabel } from '@/lib/dates';

type RuleRow = {
  dog_id: string;
  dog_name: string;
  period: string | null;
  handover: string | null;
  station_label: string | null;
  weekdays: number[];
  apartment_allowed: boolean;
};
type Vac = { id: string; date_from: string; date_to: string };
type Closure = { id: string; date_from: string; date_to: string; note: string | null };

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function Account() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [vacs, setVacs] = useState<Vac[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, v, c, cu] = await Promise.all([
      supabase.rpc('my_rules'),
      supabase.from('vacations').select('*').order('date_from'),
      supabase.from('closures').select('*').gte('date_to', new Date().toISOString().slice(0, 10)).order('date_from'),
      supabase.from('customers').select('id').maybeSingle(),
    ]);
    setRules((r.data as RuleRow[]) ?? []);
    setVacs((v.data as Vac[]) ?? []);
    setClosures((c.data as Closure[]) ?? []);
    setCustomerId((cu.data as { id: string } | null)?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function addVacation() {
    const ok = /^\d{4}-\d{2}-\d{2}$/;
    if (!customerId) return notify('Kein Kunde verknüpft', 'Dein Konto ist noch keinem Hund zugeordnet.');
    if (!ok.test(from) || !ok.test(to)) return notify('Datum prüfen', 'Bitte als JJJJ-MM-TT eingeben, zum Beispiel 2026-12-28.');
    const { error } = await supabase.from('vacations').insert({ customer_id: customerId, date_from: from, date_to: to });
    if (error) return notify('Fehler', error.message);
    setFrom('');
    setTo('');
    load();
  }

  const dogs = Array.from(new Set(rules.map((r) => r.dog_id)));

  return (
    <Screen>
      <T muted>Angemeldet als {profile?.name || profile?.email}</T>

      {dogs.length === 0 && (
        <Card>
          <T>Dein Konto ist noch keinem Hund zugeordnet. Bitte melde dich bei Dogworker.</T>
        </Card>
      )}
      {dogs.map((id) => {
        const rs = rules.filter((r) => r.dog_id === id).sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''));
        const first = rs[0];
        return (
          <Card key={id}>
            <H2>{first.dog_name}</H2>
            <T>Feste Tage: {first.weekdays.length ? [...first.weekdays].sort().map((d) => WD[d - 1]).join(', ') : 'keine'}</T>
            {rs.map((r) =>
              r.period ? (
                <T key={r.period} small muted>
                  {r.period === 'morning' ? 'Morgens' : 'Nachmittags'}: {HANDOVER_LABEL[r.handover ?? 'station']}
                  {r.station_label ? ` · ${r.station_label}` : ''}
                </T>
              ) : null,
            )}
            <T small muted>
              Regeln kann nur Dogworker ändern.
            </T>
          </Card>
        );
      })}

      <H2>Schließzeiten der Huta</H2>
      {closures.length === 0 && <T muted>Keine eingetragen.</T>}
      {closures.map((c) => (
        <T key={c.id}>
          {rangeLabel(c.date_from, c.date_to)}
          {c.note ? ` · ${c.note}` : ''}
        </T>
      ))}

      <H2>Mein Urlaub</H2>
      {vacs.map((v) => (
        <Row key={v.id}>
          <T>{rangeLabel(v.date_from, v.date_to)}</T>
          <Btn
            kind="ghost"
            title="Löschen"
            onPress={async () => {
              await supabase.from('vacations').delete().eq('id', v.id);
              load();
            }}
          />
        </Row>
      ))}
      <Card>
        <Field label="Von (JJJJ-MM-TT)" value={from} onChangeText={setFrom} placeholder="2026-12-28" autoCapitalize="none" />
        <Field label="Bis (JJJJ-MM-TT)" value={to} onChangeText={setTo} placeholder="2027-01-04" autoCapitalize="none" />
        <Btn title="Urlaub eintragen" onPress={addVacation} disabled={!from || !to} />
        <T small muted>
          Der Urlaub ist nur eine Info für die Planung. Die Anmeldung läuft weiter über Dogworker.
        </T>
      </Card>

      <Btn kind="ghost" title="Datenschutzerklärung" onPress={() => router.push('/privacy')} />
      <Btn kind="ghost" title="Abmelden" onPress={signOut} />
      <Btn
        kind="danger"
        title="Konto und Daten löschen"
        onPress={() =>
          confirmDialog('Konto wirklich löschen?', 'Dein Konto, dein Hund, dein Wochenplan und dein Urlaub werden endgültig gelöscht.', 'Endgültig löschen', async () => {
            const { error } = await supabase.rpc('delete_my_account');
            if (error) return notify('Fehler', error.message);
            await signOut();
            router.replace('/login');
          }, true)
        }
      />
    </Screen>
  );
}
