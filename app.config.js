// Ergaenzt app.json um alles, was aus Umgebungsvariablen kommt (Expo "Environment Variables").
// Schluessel stehen nie im Repo. Siehe EINRICHTUNG.md.
module.exports = ({ config }) => {
  const {
    GOOGLE_MAPS_IOS_KEY,
    GOOGLE_MAPS_ANDROID_KEY,
    GOOGLE_SERVICES_JSON, // Datei-Variable: Pfad zur google-services.json (Android-Push)
    SENTRY_ORG,
    SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN,
    SENTRY_URL,
  } = process.env;

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
    ios: {
      ...config.ios,
      config: { ...config.ios?.config, ...(GOOGLE_MAPS_IOS_KEY && { googleMapsApiKey: GOOGLE_MAPS_IOS_KEY }) },
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
