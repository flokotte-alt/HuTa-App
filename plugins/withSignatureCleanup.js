// iOS-Store-Build: Das Navigationspaket (dynamisches Pod mit Swift-Paketen) laesst Xcode die Signaturdateien der
// Google-Bausteine zweimal anlegen, einmal im gemeinsamen Ordner und einmal im Ordner des Pods. Beim Archivieren
// bricht Xcode dann ab ("... .signature couldn't be copied to Signatures ... File exists", Build vom 26.11.2026).
// Dieser Schritt im App-Ziel loescht die zweite Datei. Simulator-Builds archivieren nicht und merken davon nichts.
// Beim Aktualisieren von @googlemaps/react-native-navigation-sdk pruefen, ob das noch noetig ist.
const { withXcodeProject } = require('expo/config-plugins');

const NAME = 'Huta: doppelte Google-Signaturdateien entfernen';
const SCRIPT = [
  'products="${BUILD_DIR}/${CONFIGURATION}${EFFECTIVE_PLATFORM_NAME}"',
  'for copy in "$products/react-native-navigation-sdk/"*.signature; do',
  '  if [ -f "$copy" ] && [ -f "$products/${copy##*/}" ]; then',
  '    echo "Huta: doppelte Signaturdatei entfernt: $copy"',
  '    rm -f "$copy"',
  '  fi',
  'done',
].join('\n');

function addCleanupPhase(project) {
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
  if (Object.values(phases).some((p) => p.name === `"${NAME}"`)) return project;
  const app = Object.entries(project.pbxNativeTargetSection()).find(
    ([, t]) => typeof t === 'object' && String(t.productType).includes('product-type.application'),
  );
  if (!app) throw new Error('withSignatureCleanup: App-Ziel im Xcode-Projekt nicht gefunden.');
  project.addBuildPhase([], 'PBXShellScriptBuildPhase', NAME, app[0], {
    shellPath: '/bin/sh',
    shellScript: SCRIPT,
    alwaysOutOfDate: true,
  });
  return project;
}

const withSignatureCleanup = (config) =>
  withXcodeProject(config, (mod) => {
    addCleanupPhase(mod.modResults);
    return mod;
  });

module.exports = withSignatureCleanup;
module.exports.addCleanupPhase = addCleanupPhase;
module.exports.SCRIPT = SCRIPT;
