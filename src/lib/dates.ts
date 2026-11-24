const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

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

export const dayLabel = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;

export const timeLabel = (s: string) =>
  new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const rangeLabel = (a: string, b: string) =>
  a === b ? dayLabel(parseIso(a)) : `${dayLabel(parseIso(a))} bis ${dayLabel(parseIso(b))}`;
