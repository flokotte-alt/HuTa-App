import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Btn, Card, H1, LinkRow, Screen, Spinner, SwitchRow, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { CONSENT_SUMMARY, CONSENT_VERSION } from '@/lib/legal';
import { registerPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Consent() {
  const router = useRouter();
  const { session, profile, consent, loading, signOut, refresh } = useAuth();
  const { colors } = useTheme();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading || (session && !profile)) return <Spinner />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.must_change_password) return <Redirect href="/set-password" />;
  if (consent) return <Redirect href="/" />;

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc('accept_consent', { p_version: CONSENT_VERSION });
    if (error) {
      setBusy(false);
      return notify('Fehler', error.message);
    }
    await registerPush(true); // fragt nach der Erlaubnis fuer Push-Nachrichten
    await refresh();
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <H1>Datenschutz</H1>
        <T>
          Die App verarbeitet Daten deines Hundes und deine Kontaktdaten, damit die Abholung klappt. Der Standort des Fahrzeugs wird nur
          während einer Fahrt geteilt. Wir schicken dir Push-Nachrichten, wenn wir bald bei dir sind.
        </T>
        <Card>
          <LinkRow title="Datenschutzdokument lesen" icon="document-text-outline" onPress={() => router.push('/privacy')} />
        </Card>
        <Card>
          <SwitchRow label="Ich bin einverstanden" hint={CONSENT_SUMMARY} value={checked} onChange={setChecked} />
        </Card>
        <Btn title="Weiter" onPress={accept} disabled={!checked} busy={busy} />
        <Btn kind="ghost" title="Abmelden" onPress={signOut} />
      </Screen>
    </SafeAreaView>
  );
}
