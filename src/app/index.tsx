// Weiche: Anmeldung, erster Login (Passwort, Datenschutz), dann die App je nach Rolle
import { Redirect } from 'expo-router';
import { Btn, Center, Spinner, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, profile, consent, loading, failed, refresh, signOut } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/login" />;
  if (!profile) {
    if (!failed) return <Spinner />;
    return (
      <Center>
        <T center>Keine Verbindung. Dein Konto konnte nicht geladen werden.</T>
        <Btn title="Noch einmal versuchen" onPress={refresh} />
        <Btn kind="ghost" title="Abmelden" onPress={signOut} />
      </Center>
    );
  }
  if (profile.role === 'provider') return <Redirect href="/(provider)/home" />;
  if (profile.must_change_password) return <Redirect href="/set-password" />;
  if (!consent) return <Redirect href="/consent" />;
  return <Redirect href="/(customer)/home" />;
}
