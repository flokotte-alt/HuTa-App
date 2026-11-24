import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Btn, Field, H1, Screen, T } from '@/components/ui';
import { APP_NAME, colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const mail = email.trim().toLowerCase();
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) throw error;
        router.replace('/');
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { data: { name } } });
        if (error) throw error;
        if (!data.session) {
          Alert.alert('Fast geschafft', 'Bitte bestätige deine E-Mail-Adresse über den Link in der Nachricht, die wir dir geschickt haben.');
          setMode('login');
        } else router.replace('/');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail);
        if (error) throw error;
        Alert.alert('Gesendet', 'Du bekommst eine E-Mail zum Zurücksetzen des Passworts.');
        setMode('login');
      }
    } catch (e) {
      Alert.alert('Das hat nicht geklappt', e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, marginVertical: 16 }}>
          <Image source={require('../../assets/icon.png')} style={{ width: 110, height: 110 }} />
          <H1>{APP_NAME}</H1>
          <T muted>Hundetagesstätte Dogworker Dresden</T>
        </View>
        {mode === 'register' && <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />}
        <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        {mode !== 'reset' && <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry />}
        <Btn
          title={mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto anlegen' : 'Link senden'}
          onPress={submit}
          busy={busy}
          disabled={!email || (mode !== 'reset' && password.length < 6)}
        />
        {mode === 'login' && <Btn kind="ghost" title="Neu hier? Konto anlegen" onPress={() => setMode('register')} />}
        {mode === 'login' && <Btn kind="ghost" title="Passwort vergessen" onPress={() => setMode('reset')} />}
        {mode !== 'login' && <Btn kind="ghost" title="Zurück zur Anmeldung" onPress={() => setMode('login')} />}
        {mode === 'register' && (
          <T small muted>
            Bitte nutze die E-Mail-Adresse, die du bei Dogworker angegeben hast. So wird dein Hund automatisch verknüpft.
          </T>
        )}
      </Screen>
    </SafeAreaView>
  );
}
