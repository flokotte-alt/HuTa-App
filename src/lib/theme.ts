// Farben von dogworker-dresden.de
export const APP_NAME = 'Huta';

export const colors = {
  primary: '#eb6a0e',
  primaryLight: '#fc9a23',
  amber: '#ebaa49',
  dark: '#2c2c2c',
  grey: '#757373',
  bg: '#F2F5F7',
  card: '#FFFFFF',
  line: '#E3E6EA',
  red: '#c62828',
  green: '#2e7d32',
  muted: '#9a9a9a',
};

export const STATUS_LABEL: Record<string, string> = {
  registered: 'angemeldet',
  cancelled_billed: 'Absage mit Berechnung',
  vacation: 'Urlaub',
  removed: 'gestrichen',
  sick: 'krank',
};

export const HANDOVER_LABEL: Record<string, string> = {
  station: 'An der Station',
  apartment: 'In der Wohnung',
  self: 'Selbstbringer',
};

export const STATUS_COLOR: Record<string, string> = {
  registered: colors.dark,
  cancelled_billed: colors.red,
  vacation: colors.muted,
  removed: colors.muted,
  sick: colors.muted,
};
