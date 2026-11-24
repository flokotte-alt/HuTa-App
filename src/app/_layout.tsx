import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { colors } from '@/lib/theme';
import '@/lib/tracking'; // meldet die Hintergrund-Aufgabe fuer den Standort an
import '@/lib/push'; // Anzeige von Push-Nachrichten bei geoeffneter App

const header = { headerShown: true, headerStyle: { backgroundColor: colors.dark }, headerTintColor: '#fff' };

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="trip" options={{ ...header, title: 'Fahrt' }} />
        <Stack.Screen name="dog" options={{ ...header, title: 'Hund' }} />
        <Stack.Screen name="customer" options={{ ...header, title: 'Kunde' }} />
        <Stack.Screen name="privacy" options={{ ...header, title: 'Datenschutz' }} />
      </Stack>
    </AuthProvider>
  );
}
