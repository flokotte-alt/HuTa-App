import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Btn, Card, Divider, Field, H1, H2, LinkRow, Screen, SwitchRow, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { alwaysLocationState, requestAlwaysLocation, type AlwaysState } from '@/lib/locationPermission';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useNewVacations } from '@/lib/vacationNews';

export default function Settings() {
  const router = useRouter();
  const { profile, signOut, refresh } = useAuth();
  const { dark, setDark, colors } = useTheme();
  const news = useNewVacations();
  const [always, setAlways] = useState<AlwaysState>('unavailable');
  const [name, setName] = useState(profile?.name ?? '');

  useFocusEffect(
    useCallback(() => {
      alwaysLocationState().then(setAlways);
    }, []),
  );

  async function saveName() {
    const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', profile!.id);
    if (error) return notify('Fehler', error.message);
    await refresh();
    notify('Gespeichert');
  }

  return (
    <Screen safeTop>
      <H1>Einstellungen</H1>
      <Card>
        <LinkRow title="Urlaubsübersicht" hint="Alle Urlaube der Kunden" icon="airplane-outline" badge={news} onPress={() => router.push('/vacations')} />
        <Divider />
        <LinkRow title="Schließzeiten" hint="Wann die Hundetagesstätte zu hat" icon="calendar-outline" onPress={() => router.push('/closures')} />
        <Divider />
        <LinkRow title="Stationen" hint="Abholstationen, Start und Ziel" icon="location-outline" onPress={() => router.push('/stations')} />
        <Divider />
        <LinkRow
          title="Standardwerte"
          hint="Wohnungs-Puffer, Nachrichten, Route, Album"
          icon="options-outline"
          onPress={() => router.push('/defaults')}
        />
      </Card>

      <H2>Darstellung</H2>
      <Card>
        <SwitchRow label="Dunkelmodus" value={dark} onChange={setDark} />
      </Card>

      {always !== 'unavailable' && (
        <>
          <H2>Fahrt</H2>
          <Card>
            <T bold>Standort während der Fahrt</T>
            {always === 'granted' ? (
              <T color={colors.primary}>Immer erlaubt</T>
            ) : (
              <Btn kind="secondary" title="Standort immer erlauben" onPress={() => requestAlwaysLocation(() => alwaysLocationState().then(setAlways))} />
            )}
          </Card>
        </>
      )}

      <H2>Mein Konto</H2>
      <Card>
        <T small muted>
          {profile?.email}
        </T>
        <Field label="Mein Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Btn kind="secondary" title="Name speichern" onPress={saveName} disabled={name.trim() === (profile?.name ?? '')} />
        <Divider />
        <LinkRow title="Passwort ändern" icon="key-outline" onPress={() => router.push('/password')} />
        <Divider />
        <LinkRow title="Datenschutz" icon="document-text-outline" onPress={() => router.push('/privacy')} />
      </Card>
      <Btn kind="ghost" title="Abmelden" onPress={signOut} />
    </Screen>
  );
}
