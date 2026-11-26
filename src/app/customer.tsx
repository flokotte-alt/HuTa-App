// Ein Kunde: Stammdaten, Zugang, Hunde, Dateien
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CustomerFiles } from '@/components/CustomerFiles';
import { DateField } from '@/components/DateField';
import { Btn, Card, Field, H2, LinkRow, Screen, Spinner, T } from '@/components/ui';
import { customerAccount, isPlaceholderEmail, type AccountAction } from '@/lib/accounts';
import { sinceLabel } from '@/lib/dates';
import { confirmDialog, notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Dog = { id: string; name: string; active: boolean };
type Loaded = { email: string; user_id: string | null; pending: boolean; dogs: Dog[] };

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [since, setSince] = useState('');
  const [busy, setBusy] = useState('');
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [filled, setFilled] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('customers').select('*, dogs(id, name, active)').eq('id', id).maybeSingle();
    if (!data) return;
    const profile = data.user_id
      ? await supabase.from('profiles').select('must_change_password').eq('id', data.user_id).maybeSingle()
      : null;
    setLoaded({
      email: data.email,
      user_id: data.user_id,
      pending: !!profile?.data?.must_change_password,
      dogs: (data.dogs as Dog[]).sort((a, b) => a.name.localeCompare(b.name)),
    });
    setFilled((done) => {
      // Eingaben nicht ueberschreiben, wenn man von einem Hund zurueckkommt
      if (!done) {
        setName(data.name);
        setEmail(isPlaceholderEmail(data.email) ? '' : data.email);
        setPhone(data.phone ?? '');
        setSince(data.customer_since ?? '');
      }
      return true;
    });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const mail = email.trim().toLowerCase();

  async function save() {
    setBusy('save');
    try {
      const values = { name: name.trim(), phone: phone.trim() || null, customer_since: since || null };
      if (!id) {
        // Ohne E-Mail bekommt der Kunde vorlaeufig einen Platzhalter
        const placeholder = `platzhalter-${Date.now().toString(36)}@huta.invalid`;
        const { data, error } = await supabase.from('customers').insert({ ...values, email: mail || placeholder }).select('id').single();
        if (error) throw error;
        router.replace(`/customer?id=${data.id}`);
        return;
      }
      if (mail && mail !== loaded?.email) {
        const r = await customerAccount('update_email', id, mail);
        if (r.error) throw new Error(r.error);
      }
      const { error } = await supabase.from('customers').update(values).eq('id', id);
      if (error) throw error;
      await load();
      notify('Gespeichert');
    } catch (e) {
      const message = e instanceof Error ? e.message : ((e as { message?: string }).message ?? 'Unbekannter Fehler');
      notify('Speichern nicht möglich', message.includes('duplicate') ? 'Diese E-Mail-Adresse ist schon vergeben.' : message);
    } finally {
      setBusy('');
    }
  }

  async function account(action: AccountAction) {
    setBusy(action);
    const r = await customerAccount(action, id!, action === 'create' ? mail : undefined);
    setBusy('');
    if (r.error) return notify('Das hat nicht geklappt', r.error);
    if (r.password) setSecret({ email: r.email ?? mail, password: r.password });
    else setSecret(null);
    if (action === 'delete_customer') return router.back();
    await load();
  }

  if (id && !loaded) return <Spinner />;

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? name || 'Kunde' : 'Neuer Kunde' }} />
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field
        label="E-Mail (damit meldet sich der Kunde an)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="noch offen"
      />
      <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <DateField label="Kunde seit" value={since} onChange={setSince} clearable />
      {since ? (
        <T small muted>
          {sinceLabel(since)}
        </T>
      ) : null}
      <Btn title={id ? 'Speichern' : 'Kunde anlegen'} onPress={save} busy={busy === 'save'} disabled={!name.trim()} />

      {id && loaded && (
        <>
          <H2>Zugang zur App</H2>
          {secret && (
            <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
              <T bold>Einmalpasswort (wird nur jetzt angezeigt)</T>
              <T>E-Mail: {secret.email}</T>
              <View style={{ paddingVertical: 4 }}>
                <T bold>{secret.password}</T>
              </View>
              <T small muted>
                Der Kunde lädt die App, meldet sich damit an und setzt sofort ein eigenes Passwort.
              </T>
              <Btn
                kind="secondary"
                title="Zugangsdaten kopieren"
                icon="copy-outline"
                onPress={async () => {
                  await Clipboard.setStringAsync(`E-Mail: ${secret.email}\nEinmalpasswort: ${secret.password}`);
                  notify('Kopiert');
                }}
              />
            </Card>
          )}
          {loaded.user_id ? (
            <>
              <T>{loaded.pending ? 'Zugang angelegt, der erste Login steht noch aus.' : 'Zugang ist aktiv.'}</T>
              <Btn
                kind="secondary"
                title="Neues Einmalpasswort"
                busy={busy === 'reset'}
                onPress={() =>
                  confirmDialog('Neues Einmalpasswort?', 'Das bisherige Passwort gilt dann nicht mehr.', 'Erstellen', () => account('reset'))
                }
              />
              <Btn
                kind="ghost"
                title="Zugang entfernen"
                busy={busy === 'remove_access'}
                onPress={() =>
                  confirmDialog('Zugang entfernen?', 'Der Kunde kann sich nicht mehr anmelden. Hunde und Daten bleiben erhalten.', 'Entfernen', () => account('remove_access'), true)
                }
              />
            </>
          ) : (
            <>
              <T muted>{mail ? 'Noch kein Zugang.' : 'Für einen Zugang zuerst die E-Mail-Adresse eintragen.'}</T>
              <Btn title="Zugang mit Einmalpasswort anlegen" icon="key-outline" busy={busy === 'create'} disabled={!mail} onPress={() => account('create')} />
            </>
          )}

          <H2>Hunde und feste Regeln</H2>
          <Card>
            {loaded.dogs.map((d) => (
              <LinkRow
                key={d.id}
                title={d.name}
                hint={d.active ? 'Wochentage, Stationen, Schlüssel, Notizen' : 'archiviert'}
                icon="paw-outline"
                onPress={() => router.push(`/dog?id=${d.id}`)}
              />
            ))}
            {loaded.dogs.length === 0 && <T muted>Noch kein Hund.</T>}
          </Card>
          <Btn kind="secondary" title="Hund hinzufügen" icon="add" onPress={() => router.push(`/dog?customer=${id}`)} />

          <CustomerFiles customerId={id} />

          <View style={{ height: 12 }} />
          <Btn
            kind="ghost"
            title="Kunde löschen"
            busy={busy === 'delete_customer'}
            onPress={() =>
              confirmDialog(
                `${name} endgültig löschen?`,
                'Zugang, Hunde, Wochenplan, Urlaub und alle Dateien dieses Kunden werden gelöscht. Das lässt sich nicht zurücknehmen.',
                'Endgültig löschen',
                () => account('delete_customer'),
                true,
              )
            }
          />
        </>
      )}
    </Screen>
  );
}
