// iOS: Google Navigation 11.3.0 laesst jede neuere Karten-Version zu. Mit GoogleMaps 11.4.0 schlaegt das
// Linken fehl (fehlende GMCS-Symbole, Build vom 25.11.2026). Deshalb wird die Karten-Version festgelegt,
// indem beim Prebuild eine zweite Swift-Paket-Angabe in die Podspec des Navigationspakets geschrieben wird.
// Beim Aktualisieren von @googlemaps/react-native-navigation-sdk pruefen, ob das noch noetig ist.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const NAVIGATION_VERSION = '11.3.0';
const MAPS_VERSION = '11.3.0';
const MARKER = '# huta: GoogleMaps-Version festgelegt';

function pinGoogleMaps(podspec) {
  if (podspec.includes(MARKER)) return podspec;
  if (!podspec.includes(`version: "${NAVIGATION_VERSION}"`)) {
    throw new Error(
      `withGoogleMapsVersion: Das Navigationspaket nutzt nicht mehr GoogleNavigation ${NAVIGATION_VERSION}. Plugin pruefen.`,
    );
  }
  const anchor = '  install_modules_dependencies(s)';
  if (!podspec.includes(anchor)) throw new Error('withGoogleMapsVersion: Aufbau der Podspec hat sich geaendert.');
  const pin = [
    `  ${MARKER}`,
    '  spm_dependency(',
    '    s,',
    '    url: "https://github.com/googlemaps/ios-maps-sdk",',
    `    requirement: { kind: "exactVersion", version: "${MAPS_VERSION}" },`,
    '    products: ["GoogleMaps"]',
    '  )',
    '',
    anchor,
  ].join('\n');
  return podspec.replace(anchor, () => pin);
}

const withGoogleMapsVersion = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const pkg = require.resolve('@googlemaps/react-native-navigation-sdk/package.json', {
        paths: [mod.modRequest.projectRoot],
      });
      const file = path.join(path.dirname(pkg), 'react-native-navigation-sdk.podspec');
      fs.writeFileSync(file, pinGoogleMaps(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')));
      return mod;
    },
  ]);

module.exports = withGoogleMapsVersion;
module.exports.pinGoogleMaps = pinGoogleMaps;
