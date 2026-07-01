const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/**
 * Local (not UTC) YYYY-MM-DD for an already-constructed Date. Use this instead of
 * `d.toISOString().slice(0, 10)` — toISOString() always converts to UTC, which
 * silently shifts the date back by one during 00:00–02:59 Moscow time.
 *
 * Safe for CLIENT components: the browser's system TZ genuinely is the user's TZ.
 * For SERVER-side "what day is today", use `todayISOMoscow()` instead — Vercel
 * functions default to system TZ = UTC regardless of where the user actually is.
 */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Moscow is UTC+3 year-round (no DST since 2014) — safe to hardcode.
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/**
 * "Now" as a UTC-anchored Date whose UTC getters (getUTCFullYear/getUTCMonth/...)
 * give Moscow's current wall-clock date/time — independent of the server's own
 * system timezone. Vercel's Node runtime defaults to TZ=UTC regardless of where
 * the user actually is, so plain `new Date()` + local getters/toISOString() are
 * NOT reliable server-side for "what day is today".
 */
export function nowMoscow(): Date {
  return new Date(Date.now() + MSK_OFFSET_MS);
}

function isoFromUTCParts(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Today's date in Moscow time (server-side "today" — see nowMoscow()). */
export function todayISOMoscow(): string {
  return isoFromUTCParts(nowMoscow());
}

/** ISO date N days from Moscow "today" (negative = past, positive = future). */
export function isoDaysFromTodayMoscow(n: number): string {
  return isoFromUTCParts(new Date(nowMoscow().getTime() + n * DAY_MS));
}

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
