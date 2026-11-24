import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Btn, H1, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { CONSENT_SUMMARY, CONSENT_VERSION } from '@/lib/legal';
import { registerPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function Consent() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc('accept_consent', { p_version: CONSENT_VERSION });
    if (error) {
      setBusy(false);
      return notify('Fehler', error.message);
    }
    await registerPush(true); // fragt nach der Erlaubnis fuer Push-Nachrichten
    setBusy(false);
    router.replace('/');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <H1>Bevor es losgeht</H1>
        <T>
          Die App verarbeitet Daten deines Hundes und deine Kontaktdaten, damit die Abholung klappt. Der Standort des Fahrzeugs wird nur
          während einer Fahrt geteilt. Wir schicken dir Push-Nachrichten, zum Beispiel wenn die Abholung startet.
        </T>
        <Pressable onPress={() => router.push('/privacy')}>
          <T bold color={colors.primary}>
            Datenschutzerklärung lesen
          </T>
        </Pressable>
        <Pressable onPress={() => setChecked(!checked)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: checked ? colors.primary : '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {checked && <T color="#fff" bold>✓</T>}
          </View>
          <View style={{ flex: 1 }}>
            <T>{CONSENT_SUMMARY}</T>
          </View>
        </Pressable>
        <Btn title="Einverstanden und weiter" onPress={accept} disabled={!checked} busy={busy} />
        <Btn kind="ghost" title="Abmelden" onPress={signOut} />
      </Screen>
    </SafeAreaView>
  );
}
