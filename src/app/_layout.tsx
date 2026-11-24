import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { colors } from '@/lib/theme';

const header = { headerShown: true, headerStyle: { backgroundColor: colors.dark }, headerTintColor: '#fff' };

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="trip" options={{ ...header, title: 'Fahrt' }} />
        <Stack.Screen name="dog" options={{ ...header, title: 'Hund' }} />
      </Stack>
    </AuthProvider>
  );
}
