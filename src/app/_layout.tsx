import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { withErrorReports } from '@/lib/sentry';
import { useAutoUpdates } from '@/lib/updates';
import '@/lib/tracking'; // meldet die Hintergrund-Aufgabe fuer den Standort an
import '@/lib/push'; // Anzeige von Push-Nachrichten bei geoeffneter App

// Dunkelmodus ist im Build vorbereitet, die Optik bleibt vorerst hell
if (Platform.OS !== 'web') Appearance.setColorScheme('light');

const header = { headerShown: true, headerStyle: { backgroundColor: colors.dark }, headerTintColor: '#fff' };

function RootLayout() {
  useAutoUpdates();
  useEffect(() => {
    if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="trip" options={{ ...header, title: 'Fahrt' }} />
          <Stack.Screen name="navigate" options={{ ...header, title: 'Navigation' }} />
          <Stack.Screen name="dog" options={{ ...header, title: 'Hund' }} />
          <Stack.Screen name="customer" options={{ ...header, title: 'Kunde' }} />
          <Stack.Screen name="privacy" options={{ ...header, title: 'Datenschutz' }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default withErrorReports(RootLayout);
