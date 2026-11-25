// Fehlerberichte (Sentry). Aktiv erst, wenn EXPO_PUBLIC_SENTRY_DSN in Expo gesetzt ist.
import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) Sentry.init({ dsn, sendDefaultPii: false });

export const withErrorReports = (Root: ComponentType): ComponentType => (dsn ? Sentry.wrap(Root) : Root);
