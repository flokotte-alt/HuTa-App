import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SystemUI from 'expo-system-ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { withErrorReports } from '@/lib/sentry';
import { useAutoUpdates } from '@/lib/updates';
import '@/lib/tracking'; // meldet die Hintergrund-Aufgabe fuer den Standort an
import '@/lib/push'; // Anzeige von Push-Nachrichten bei geoeffneter App

function Screens() {
  const { colors, dark } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.header },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
  };
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="trip" options={{ ...header, title: 'Fahrt' }} />
        <Stack.Screen name="customer" options={{ ...header, title: 'Kunde' }} />
        <Stack.Screen name="dog" options={{ ...header, title: 'Hund' }} />
        <Stack.Screen name="vacations" options={{ ...header, title: 'Urlaubsübersicht' }} />
        <Stack.Screen name="closures" options={{ ...header, title: 'Schließzeiten' }} />
        <Stack.Screen name="stations" options={{ ...header, title: 'Stationen' }} />
        <Stack.Screen name="defaults" options={{ ...header, title: 'Standardwerte' }} />
        <Stack.Screen name="password" options={{ ...header, title: 'Passwort ändern' }} />
        <Stack.Screen name="privacy" options={{ ...header, title: 'Datenschutz' }} />
      </Stack>
    </>
  );
}

function RootLayout() {
  useAutoUpdates();
  useEffect(() => {
    if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <Screens />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default withErrorReports(RootLayout);
