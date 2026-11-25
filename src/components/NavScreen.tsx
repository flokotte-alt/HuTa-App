// Navigation in der App (Google Navigation SDK). Die Web-Vorschau nutzt NavScreen.web.tsx.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  NavigationProvider,
  NavigationSessionStatus,
  NavigationView,
  RouteStatus,
  TravelMode,
  useNavigation,
} from '@googlemaps/react-native-navigation-sdk';
import { Btn, Center, Row, Spinner, T } from '@/components/ui';
import { colors } from '@/lib/theme';

export type NavProps = {
  target: { lat: number; lng: number; label: string };
  onClose: () => void;
  onExternal: () => void;
};

const SESSION_ERRORS: Partial<Record<NavigationSessionStatus, string>> = {
  [NavigationSessionStatus.NOT_AUTHORIZED]: 'Der Google-Schlüssel ist nicht freigeschaltet.',
  [NavigationSessionStatus.TERMS_NOT_ACCEPTED]: 'Die Nutzungsbedingungen von Google wurden nicht angenommen.',
  [NavigationSessionStatus.NETWORK_ERROR]: 'Keine Verbindung.',
  [NavigationSessionStatus.LOCATION_PERMISSION_MISSING]: 'Bitte Standort erlauben.',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function NavScreen(props: NavProps) {
  return (
    <NavigationProvider termsAndConditionsDialogOptions={{ title: 'Nutzungsbedingungen', companyName: 'Dogworker Dresden' }}>
      <Guidance {...props} />
    </NavigationProvider>
  );
}

function Guidance({ target, onClose, onExternal }: NavProps) {
  const { navigationController, setOnArrival, removeAllListeners } = useNavigation();
  const [ready, setReady] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState('');
  useKeepAwake();

  // Querformat nur hier erlauben (Handy in der Halterung)
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const fail = (text: string) => {
      if (alive) setError(text);
    };

    async function start() {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return fail('Bitte Standort erlauben.');
      const accepted =
        (await navigationController.areTermsAccepted()) || (await navigationController.showTermsAndConditionsDialog());
      if (!accepted) return fail(SESSION_ERRORS[NavigationSessionStatus.TERMS_NOT_ACCEPTED]!);
      const status = await navigationController.init();
      if (status !== NavigationSessionStatus.OK) return fail(SESSION_ERRORS[status] ?? 'Navigation konnte nicht starten.');
      if (!alive) return;
      setReady(true);
      setOnArrival(() => {
        if (alive) setArrived(true);
      });
      navigationController.startUpdatingLocation();
      if (Platform.OS === 'ios') navigationController.setBackgroundLocationUpdatesEnabled(true);

      // Die Route geht erst, wenn die Navigation den Standort kennt
      for (let i = 0; i < 20 && alive; i++) {
        const route = await navigationController.setDestinations(
          [{ title: target.label, position: { lat: target.lat, lng: target.lng } }],
          { routingOptions: { travelMode: TravelMode.DRIVING }, displayOptions: { showDestinationMarkers: true } },
        );
        if (route === RouteStatus.OK) {
          await navigationController.startGuidance();
          return;
        }
        if (route !== RouteStatus.LOCATION_DISABLED && route !== RouteStatus.LOCATION_UNKNOWN) {
          return fail(`Keine Route gefunden (${route}).`);
        }
        await wait(1500);
      }
      fail('Der Standort wurde noch nicht gefunden.');
    }

    start().catch((e) => fail(e instanceof Error ? e.message : 'Navigation konnte nicht starten.'));

    return () => {
      alive = false;
      removeAllListeners();
      (async () => {
        await navigationController.stopGuidance();
        await navigationController.clearDestinations();
        await navigationController.cleanup();
      })().catch(() => {});
    };
    // nur beim Oeffnen starten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {error ? (
          <Center>
            <View style={{ padding: 24 }}>
              <T bold>{error}</T>
            </View>
          </Center>
        ) : ready ? (
          <NavigationView style={{ flex: 1 }} />
        ) : (
          <Spinner />
        )}
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        {arrived && <T bold>Angekommen: {target.label}</T>}
        <Row>
          <View style={{ flex: 1 }}>
            <Btn kind={arrived ? 'primary' : 'dark'} title="Zurück zur Fahrt" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn kind="ghost" title="Karten-App" onPress={onExternal} />
          </View>
        </Row>
      </View>
    </SafeAreaView>
  );
}
