const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatWeekdayDay(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${formatDay(d)}`;
}

/** Русское склонение: 1 день, 2 дня, 5 дней. */
export function pluralDays(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  const word =
    a > 10 && a < 20 ? "дней" : b === 1 ? "день" : b >= 2 && b <= 4 ? "дня" : "дней";
  return `${n} ${word}`;
}
