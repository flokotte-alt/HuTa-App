// Navigation direkt im Fahrbildschirm (Google Navigation SDK), ohne Sprachansagen.
// Die Web-Vorschau nutzt DriveMap.web.tsx.
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Location from 'expo-location';
import {
  AudioGuidanceMode,
  NavigationNightMode,
  NavigationProvider,
  NavigationSessionStatus,
  NavigationView,
  RouteStatus,
  TravelMode,
  useNavigation,
} from '@googlemaps/react-native-navigation-sdk';
import { RouteSketch } from './RouteSketch';
import { Btn, Spinner, T } from './ui';
import { hasGoogleMaps } from '@/lib/google';
import { openMaps } from '@/lib/maps';
import { useTheme } from '@/lib/theme';
import type { DriveMapProps } from './driveMapTypes';

const SESSION_ERRORS: Partial<Record<NavigationSessionStatus, string>> = {
  [NavigationSessionStatus.NOT_AUTHORIZED]: 'Der Google-Schlüssel ist nicht freigeschaltet.',
  [NavigationSessionStatus.TERMS_NOT_ACCEPTED]: 'Die Nutzungsbedingungen von Google wurden nicht angenommen.',
  [NavigationSessionStatus.NETWORK_ERROR]: 'Keine Verbindung.',
  [NavigationSessionStatus.LOCATION_PERMISSION_MISSING]: 'Bitte den Standort erlauben.',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function DriveMap(props: DriveMapProps) {
  if (!hasGoogleMaps) return <WithoutGoogle {...props} />;
  return (
    <NavigationProvider termsAndConditionsDialogOptions={{ title: 'Nutzungsbedingungen', companyName: 'Dogworker Dresden' }}>
      <Guidance {...props} />
    </NavigationProvider>
  );
}

// Test-Version ohne Google-Schluessel: Skizze und Knopf zur Karten-App
function WithoutGoogle({ ref, target, stops, vehicle }: DriveMapProps) {
  const { colors } = useTheme();
  useImperativeHandle(ref, () => ({ remainingSeconds: async () => null, applyRoute: async () => false }), []);
  return (
    <View style={{ flex: 1 }}>
      <RouteSketch stops={stops} vehicle={vehicle} />
      <View style={{ padding: 12, gap: 8, backgroundColor: colors.card }}>
        <T small muted>
          Test-Version ohne Google: hier noch keine Karte und keine Navigation.
        </T>
        {target && <Btn kind="secondary" title="In Karten-App öffnen" icon="navigate" onPress={() => openMaps(target)} />}
      </View>
    </View>
  );
}

function Guidance({ ref, target, stops, vehicle, onRemaining }: DriveMapProps) {
  const { navigationController, setOnRemainingTimeOrDistanceChanged, removeAllListeners } = useNavigation();
  const { colors, dark } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const run = useRef(0);
  const remaining = useRef(onRemaining);
  remaining.current = onRemaining;
  const guiding = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      remainingSeconds: async () => {
        if (!guiding.current) return null;
        try {
          const t = await navigationController.getCurrentTimeAndDistance();
          return Number.isFinite(t?.seconds) ? t.seconds : null;
        } catch {
          return null;
        }
      },
      applyRoute: async (routeToken: string) => {
        if (!guiding.current) return false;
        try {
          const status = await navigationController.setDestinationsWithToken({ routeToken });
          if (status !== RouteStatus.OK) return false;
          await navigationController.startGuidance();
          return true;
        } catch {
          return false;
        }
      },
    }),
    [navigationController],
  );

  // Einmal einrichten
  useEffect(() => {
    let alive = true;
    const fail = (text: string) => alive && setError(text);
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return fail('Bitte den Standort erlauben.');
      const accepted = (await navigationController.areTermsAccepted()) || (await navigationController.showTermsAndConditionsDialog());
      if (!accepted) return fail(SESSION_ERRORS[NavigationSessionStatus.TERMS_NOT_ACCEPTED]!);
      const status = await navigationController.init();
      if (status !== NavigationSessionStatus.OK) return fail(SESSION_ERRORS[status] ?? 'Die Navigation konnte nicht starten.');
      if (!alive) return;
      await navigationController.setAudioGuidanceSettings({
        guidanceMode: AudioGuidanceMode.SILENT,
        vibrationEnabled: false,
        bluetoothAudioEnabled: false,
      });
      setOnRemainingTimeOrDistanceChanged((t) => remaining.current?.(t.seconds));
      navigationController.startUpdatingLocation();
      if (Platform.OS === 'ios') navigationController.setBackgroundLocationUpdatesEnabled(true);
      if (alive) setReady(true);
    })().catch((e) => fail(e instanceof Error ? e.message : 'Die Navigation konnte nicht starten.'));

    return () => {
      alive = false;
      guiding.current = false;
      setReady(false);
      removeAllListeners();
      (async () => {
        await navigationController.stopGuidance();
        await navigationController.clearDestinations();
        await navigationController.cleanup();
      })().catch(() => {});
    };
    // nur beim Oeffnen und bei "Erneut versuchen"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Neues Ziel: Route zum naechsten Stopp
  useEffect(() => {
    if (!ready || !target) return;
    const me = ++run.current;
    guiding.current = false;
    (async () => {
      // Die Route geht erst, wenn die Navigation den Standort kennt
      for (let i = 0; i < 20 && me === run.current; i++) {
        const status = await navigationController.setDestinations(
          [{ title: target.label, position: { lat: target.lat, lng: target.lng } }],
          { routingOptions: { travelMode: TravelMode.DRIVING }, displayOptions: { showDestinationMarkers: true } },
        );
        if (me !== run.current) return;
        if (status === RouteStatus.OK) {
          await navigationController.startGuidance();
          guiding.current = true;
          return;
        }
        if (status !== RouteStatus.LOCATION_DISABLED && status !== RouteStatus.LOCATION_UNKNOWN) {
          return setError('Keine Route gefunden.');
        }
        await wait(1500);
      }
      if (me === run.current) setError('Der Standort wurde noch nicht gefunden.');
    })().catch((e) => setError(e instanceof Error ? e.message : 'Die Navigation konnte nicht starten.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, target?.id]);

  if (error) {
    return (
      <View style={{ flex: 1 }}>
        <RouteSketch stops={stops} vehicle={vehicle} />
        <View style={{ padding: 12, gap: 8, backgroundColor: colors.card }}>
          <T bold>{error}</T>
          <Btn
            kind="secondary"
            title="Erneut versuchen"
            onPress={() => {
              setError('');
              setAttempt((a) => a + 1);
            }}
          />
          {target && <Btn kind="ghost" title="Ausnahmsweise in Karten-App öffnen" onPress={() => openMaps(target)} />}
        </View>
      </View>
    );
  }
  if (!ready) return <Spinner />;
  return (
    <NavigationView
      style={{ flex: 1 }}
      navigationNightMode={dark ? NavigationNightMode.FORCE_NIGHT : NavigationNightMode.FORCE_DAY}
      footerEnabled={false}
      tripProgressBarEnabled={false}
      trafficPromptsEnabled={false}
      reportIncidentButtonEnabled={false}
    />
  );
}
