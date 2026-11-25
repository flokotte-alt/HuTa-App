// Standard-Einstellungen von Expo, ergaenzt um lesbare Fehlerberichte (Sentry).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
