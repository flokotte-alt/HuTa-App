// Profil der Kunden: Urlaub eintragen, Passwort aendern, Darstellung
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { DateField } from '@/components/DateField';
import { PasswordForm } from '@/components/PasswordForm';
import { Btn, Card, Grow, H1, H2, IconBtn, LinkRow, Row, Screen, SwitchRow, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { iso, rangeLabel } from '@/lib/dates';
import { confirmDialog, notify } from '@/lib/dialog';
import { useLive } from '@/lib/live';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Vac = { id: string; date_from: string; date_to: string };

export default function Profile() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { dark, setDark } = useTheme();
  const [vacations, setVacations] = useState<Vac[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(false);
  const today = iso(new Date());

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('vacations').select('id, date_from, date_to').gte('date_to', today).order('date_from');
    if (!error) setVacations(data as Vac[]);
  }, [today]);

  useLive(load, ['vacations']);

  async function add() {
    if (to < from) return notify('Datum prüfen', '"Bis" liegt vor "Von".');
    setBusy(true);
    const customer = await supabase.from('customers').select('id').maybeSingle();
    const { error } = customer.data
      ? await supabase.from('vacations').insert({ customer_id: customer.data.id, date_from: from, date_to: to })
      : { error: { message: 'Dein Konto ist noch keinem Kunden zugeordnet.' } };
    setBusy(false);
    if (error) return notify('Fehler', error.message);
    setFrom('');
    setTo('');
    notify('Urlaub eingetragen');
    load();
  }

  return (
    <Screen safeTop>
      <H1>Profil</H1>
      <T muted>{profile?.name || profile?.email}</T>

      <H2>Mein Urlaub</H2>
      {vacations.length === 0 && <T muted>Kein Urlaub eingetragen.</T>}
      {vacations.map((v) => (
        <Card key={v.id}>
          <Row>
            <Grow>
              <T bold>{rangeLabel(v.date_from, v.date_to)}</T>
            </Grow>
            <IconBtn
              icon="trash-outline"
              label="Urlaub löschen"
              onPress={() =>
                confirmDialog('Urlaub löschen?', rangeLabel(v.date_from, v.date_to), 'Löschen', async () => {
                  const { error } = await supabase.from('vacations').delete().eq('id', v.id);
                  if (error) notify('Fehler', error.message);
                  load();
                }, true)
              }
            />
          </Row>
        </Card>
      ))}
      <Card>
        <DateField
          label="Von"
          value={from}
          onChange={(v) => {
            setFrom(v);
            if (to && to < v) setTo('');
          }}
          min={today}
        />
        <DateField label="Bis" value={to} onChange={setTo} min={from || today} />
        <Btn title="Urlaub eintragen" onPress={add} disabled={!from || !to} busy={busy} />
        <T small muted>
          Der Eintrag ist eine Information für uns. An der Wochenliste ändert er nichts automatisch.
        </T>
      </Card>

      <H2>Passwort</H2>
      <Card>
        {password ? (
          <>
            <PasswordForm
              askCurrent
              submitTitle="Passwort ändern"
              onDone={() => {
                setPassword(false);
                notify('Passwort geändert');
              }}
            />
            <Btn kind="ghost" title="Abbrechen" onPress={() => setPassword(false)} />
          </>
        ) : (
          <Btn kind="secondary" title="Passwort ändern" icon="key-outline" onPress={() => setPassword(true)} />
        )}
      </Card>

      <H2>Darstellung</H2>
      <Card>
        <SwitchRow label="Dunkelmodus" value={dark} onChange={setDark} />
      </Card>

      <Card>
        <LinkRow title="Datenschutz" icon="document-text-outline" onPress={() => router.push('/privacy')} />
      </Card>
      <Btn kind="ghost" title="Abmelden" onPress={signOut} />
    </Screen>
  );
}
