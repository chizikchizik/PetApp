// Чистые агрегации для экрана инсайтов по мигрени.
import { daysBetween, addDays } from "@/lib/cycle";
import { formatDay } from "@/lib/format";

export type MEvent = { date: string; aura: boolean; triptan: boolean };

const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type MonthBar = { ym: string; label: string; total: number; triptan: number };

export function monthlyTriptan(events: MEvent[], today: Date, months: number): MonthBar[] {
  const bars: MonthBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    bars.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTHS_SHORT[d.getMonth()],
      total: 0,
      triptan: 0,
    });
  }
  const map = new Map(bars.map((b) => [b.ym, b]));
  for (const e of events) {
    const b = map.get(e.date.slice(0, 7));
    if (b) {
      b.total++;
      if (e.triptan) b.triptan++;
    }
  }
  return bars;
}

export function allMonthlyBars(events: MEvent[]): MonthBar[] {
  if (events.length === 0) return [];
  const first = events[0].date.slice(0, 7);
  const today = new Date();
  const last = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const bars: MonthBar[] = [];
  let [y, m] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    bars.push({ ym: `${y}-${String(m).padStart(2, "0")}`, label: MONTHS_SHORT[m - 1], total: 0, triptan: 0 });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  const map = new Map(bars.map((b) => [b.ym, b]));
  for (const e of events) {
    const b = map.get(e.date.slice(0, 7));
    if (b) { b.total++; if (e.triptan) b.triptan++; }
  }
  return bars;
}

export function perimenstrualStats(events: MEvent[], starts: Date[]) {
  let peri = 0;
  for (const e of events) {
    const ed = new Date(e.date + "T00:00:00");
    if (starts.some((s) => {
      const d = daysBetween(s, ed);
      return d >= -2 && d <= 3;
    })) {
      peri++;
    }
  }
  const total = events.length;
  return { total, peri, pct: total ? Math.round((peri / total) * 100) : 0 };
}

// ── Cycle correlation analysis ──────────────────────────────────────────────

export type CorrelationState =
  | "no_cycle"       // нет данных о цикле
  | "no_migraine"    // нет записей о мигрени
  | "insufficient"   // < 5 приступов или < 3 циклов — слишком мало для вывода
  | "low"            // pct < 15 — совпадение случайного уровня
  | "moderate"       // 15 ≤ pct < 35 — умеренная связь
  | "high"           // 35 ≤ pct < 60 — менструально-ассоциированная
  | "very_high";     // pct ≥ 60 — очень высокая связь

export type CycleCorrelation = {
  state: CorrelationState;
  pct: number;
  peri: number;
  total: number;
  cycleCount: number;
};

export function cycleCorrelation(events: MEvent[], starts: Date[]): CycleCorrelation {
  const cycleCount = starts.length;
  const total = events.length;

  if (cycleCount === 0) return { state: "no_cycle",     pct: 0, peri: 0, total, cycleCount };
  if (total === 0)      return { state: "no_migraine",  pct: 0, peri: 0, total: 0, cycleCount };

  let peri = 0;
  for (const e of events) {
    const ed = new Date(e.date + "T00:00:00");
    if (starts.some((s) => { const d = daysBetween(s, ed); return d >= -2 && d <= 3; })) {
      peri++;
    }
  }
  const pct = total > 0 ? Math.round((peri / total) * 100) : 0;

  if (total < 5 || cycleCount < 3) return { state: "insufficient", pct, peri, total, cycleCount };
  if (pct >= 60) return { state: "very_high", pct, peri, total, cycleCount };
  if (pct >= 35) return { state: "high",      pct, peri, total, cycleCount };
  if (pct >= 15) return { state: "moderate",  pct, peri, total, cycleCount };
  return              { state: "low",         pct, peri, total, cycleCount };
}

export type CalDay = { day: number; menstrual: boolean; migraine: boolean; isToday: boolean };
export type CalCycle = { label: string; length: number; days: CalDay[] };

export function buildCycleCalendar(
  starts: Date[],
  events: MEvent[],
  today: Date,
  n: number,
  menstrualDays = 5,
): CalCycle[] {
  const sorted = [...starts].sort((a, b) => a.getTime() - b.getTime());
  const migSet = new Set(events.filter((e) => e.triptan || true).map((e) => e.date));
  const cycles: CalCycle[] = [];
  for (let k = sorted.length - 1; k >= 0 && cycles.length < n; k--) {
    const start = sorted[k];
    const isOngoing = k === sorted.length - 1;
    const length = isOngoing
      ? Math.max(1, daysBetween(start, today) + 1)
      : daysBetween(start, sorted[k + 1]);
    const todayDay = isOngoing ? daysBetween(start, today) + 1 : -1;
    const days: CalDay[] = [];
    for (let d = 1; d <= Math.min(length, 35); d++) {
      const iso = isoLocal(addDays(start, d - 1));
      days.push({
        day: d,
        menstrual: d <= menstrualDays,
        migraine: migSet.has(iso),
        isToday: d === todayDay,
      });
    }
    cycles.push({ label: formatDay(start), length, days });
  }
  return cycles;
}
