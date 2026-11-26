import { useState } from 'react';
import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Btn, Field, H1, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { APP_NAME, useTheme } from '@/lib/theme';

export default function Login() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) {
      return notify(
        'Anmeldung nicht möglich',
        error.code === 'invalid_credentials' ? 'E-Mail oder Passwort stimmen nicht.' : 'Bitte Verbindung prüfen und noch einmal versuchen.',
      );
    }
    router.replace('/');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <View style={{ alignItems: 'center', gap: 10, marginVertical: 20 }}>
          <Image source={require('../../assets/icon.png')} style={{ width: 104, height: 104, borderRadius: 24 }} accessibilityIgnoresInvertColors />
          <H1>{APP_NAME}</H1>
          <T muted center>
            Hundetagesstätte Dogworker Dresden
          </T>
        </View>
        <Field
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
        />
        <Field
          label="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          onSubmitEditing={() => email && password && submit()}
        />
        <Btn title="Anmelden" onPress={submit} busy={busy} disabled={!email || !password} />
        <T small muted center>
          Deinen Zugang bekommst du von der Hundetagesstätte. Beim ersten Mal meldest du dich mit dem Einmalpasswort an. Passwort
          vergessen? Melde dich bei uns, du bekommst ein neues.
        </T>
      </Screen>
    </SafeAreaView>
  );
}
