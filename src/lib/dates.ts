const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const mondayOf = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
};

// Am Wochenende gilt schon die kommende Woche als aktuelle
export const currentWeekMonday = (now = new Date()) => mondayOf(addDays(now, 2));

export const shortDay = (d: Date) => DAYS[d.getDay()];
export const longDay = (d: Date) => DAYS_LONG[d.getDay()];
export const shortDate = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
export const dayLabel = (d: Date) => `${DAYS[d.getDay()]} ${shortDate(d)}`;
export const longDateLabel = (s: string) => {
  const d = parseIso(s);
  return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const fullDateLabel = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export const timeLabel = (s: string | Date) =>
  new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const rangeLabel = (a: string, b: string) => {
  const from = parseIso(a);
  const to = parseIso(b);
  const year = to.getFullYear() !== new Date().getFullYear() ? ` ${to.getFullYear()}` : '';
  return a === b ? `${dayLabel(from)}${year}` : `${dayLabel(from)} bis ${dayLabel(to)}${year}`;
};

// "Kunde seit März 2024 (2 Jahre)"
export function sinceLabel(since: string | null) {
  if (!since) return 'Kunde seit: noch offen';
  const d = parseIso(since);
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  const span =
    months < 1 ? 'neu' : months < 12 ? `${months} ${months === 1 ? 'Monat' : 'Monate'}` : `${Math.floor(months / 12)} ${months < 24 ? 'Jahr' : 'Jahre'}`;
  return `Kunde seit ${MONTHS[d.getMonth()]} ${d.getFullYear()} (${span})`;
}
