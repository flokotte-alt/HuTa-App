// Erster Login eines Kunden: sofort ein eigenes Passwort setzen
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PasswordForm } from '@/components/PasswordForm';
import { Btn, H1, Screen, Spinner, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function SetPassword() {
  const { session, profile, loading, signOut } = useAuth();
  const { colors } = useTheme();
  if (loading || (session && !profile)) return <Spinner />;
  if (!session) return <Redirect href="/login" />;
  // Sobald das Passwort gesetzt ist, geht es weiter
  if (!profile?.must_change_password) return <Redirect href="/" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <H1>Eigenes Passwort setzen</H1>
        <T>Du hast dich mit einem Einmalpasswort angemeldet. Wähle jetzt dein eigenes Passwort.</T>
        <PasswordForm askCurrent={false} submitTitle="Passwort speichern" onDone={() => {}} />
        <Btn kind="ghost" title="Abmelden" onPress={signOut} />
      </Screen>
    </SafeAreaView>
  );
}
