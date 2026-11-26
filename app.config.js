// Ergaenzt app.json um alles, was aus Umgebungsvariablen kommt (Expo "Environment Variables").
// Schluessel stehen nie im Repo. Siehe EINRICHTUNG.md.

// Test-Build ohne Google (Profil "ohne-google" in eas.json). Die App zeigt dann Skizzen statt Karte
// und Navigation (src/lib/google.ts). Der Platzhalter entsteht nur in diesem Profil.
const PLACEHOLDER = 'PLATZHALTER-OHNE-GOOGLE';
// Mit dieser Version wurde ohne Google gebaut. Echte Schluessel brauchen eine neue Version, damit ein
// Update nie bei dem Build ohne Google landet. Diesen Wert nicht aendern.
const VERSION_WITHOUT_GOOGLE = '0.3.0';
const isReal = (key) => !!key && !key.startsWith('PLATZHALTER');

module.exports = ({ config }) => {
  const {
    GOOGLE_MAPS_IOS_KEY,
    GOOGLE_MAPS_ANDROID_KEY,
    HUTA_OHNE_GOOGLE,
    GOOGLE_SERVICES_JSON, // Datei-Variable: Pfad zur google-services.json (Android-Push)
    SENTRY_ORG,
    SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN,
    SENTRY_URL,
  } = process.env;

  const hasRealKey = isReal(GOOGLE_MAPS_IOS_KEY) || isReal(GOOGLE_MAPS_ANDROID_KEY);
  if (HUTA_OHNE_GOOGLE === '1' && hasRealKey) {
    throw new Error('Profil "ohne-google": Es gibt schon einen echten Google-Schluessel. Bitte mit Profil "preview" bauen.');
  }
  if (hasRealKey && config.version === VERSION_WITHOUT_GOOGLE) {
    throw new Error(`Version ${config.version} wurde ohne Google gebaut. Bitte "version" in app.json erhoehen.`);
  }
  const iosKey = HUTA_OHNE_GOOGLE === '1' ? PLACEHOLDER : GOOGLE_MAPS_IOS_KEY;

  const plugins = [...(config.plugins ?? [])];
  // Nur zum Hochladen lesbarer Fehlerberichte. Die App laeuft auch ohne.
  if (SENTRY_ORG && SENTRY_PROJECT && SENTRY_AUTH_TOKEN) {
    plugins.push([
      '@sentry/react-native',
      { organization: SENTRY_ORG, project: SENTRY_PROJECT, url: SENTRY_URL || 'https://de.sentry.io/' },
    ]);
  }

  return {
    ...config,
    plugins,
    extra: { ...config.extra, googleMaps: { ios: isReal(iosKey), android: isReal(GOOGLE_MAPS_ANDROID_KEY) } },
    ios: {
      ...config.ios,
      config: { ...config.ios?.config, ...(iosKey && { googleMapsApiKey: iosKey }) },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(GOOGLE_MAPS_ANDROID_KEY && { googleMaps: { apiKey: GOOGLE_MAPS_ANDROID_KEY } }),
      },
      ...(GOOGLE_SERVICES_JSON && { googleServicesFile: GOOGLE_SERVICES_JSON }),
    },
  };
};
