// Farben und Dunkelmodus. Der Dunkelmodus haengt nicht am Handy, sondern an einem Schalter (Standard: aus).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_NAME = 'Huta';

// Tannengruen auf ruhigem Cremeweiss. Blau ist nur fuer Urlaub reserviert, Grau fuer "abgesagt".
const light = {
  bg: '#F4F3EE',
  card: '#FCFBF8',
  field: '#FFFFFF',
  text: '#1F2623',
  muted: '#5F6964',
  faint: '#9BA39F',
  line: '#DEDDD5',
  primary: '#2B5A4B',
  onPrimary: '#FFFFFF',
  primarySoft: '#E2EBE6',
  danger: '#98312F',
  onDanger: '#FFFFFF',
  header: '#FCFBF8',
  vacation: '#1D5FBF',
  cancelledBg: '#D9DAD7',
  cancelledText: '#626663',
  draftBg: '#F5E79A',
  draftText: '#2E2A0C',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#131715',
  card: '#1B211E',
  field: '#222926',
  text: '#E9EAE5',
  muted: '#A3ADA8',
  faint: '#6E7873',
  line: '#313A36',
  primary: '#7DB9A4',
  onPrimary: '#0E1D17',
  primarySoft: '#24352E',
  danger: '#E0807C',
  onDanger: '#26100F',
  header: '#1B211E',
  vacation: '#7FB0FF',
  cancelledBg: '#3A3F3D',
  cancelledText: '#A9AEAB',
  draftBg: '#5C5214',
  draftText: '#FFF4B8',
};

const KEY = 'huta:dark';

type Ctx = { colors: Colors; dark: boolean; setDark: (v: boolean) => void };
const ThemeContext = createContext<Ctx>({ colors: light, dark: false, setDark: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setIsDark(v === '1'))
      .catch(() => {});
  }, []);

  // Auch Systemdialoge, Datumsauswahl und Karte folgen dem Schalter
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  const value = useMemo<Ctx>(
    () => ({
      colors: isDark ? dark : light,
      dark: isDark,
      setDark: (v) => {
        setIsDark(v);
        AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
      },
    }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export const HANDOVER_LABEL: Record<string, string> = {
  station: 'An der Station',
  apartment: 'In die Wohnung',
  self: 'Selbstabholung',
};

export const PERIOD_LABEL: Record<string, string> = {
  morning: 'Morgenfahrt',
  afternoon: 'Nachmittagsfahrt',
};
