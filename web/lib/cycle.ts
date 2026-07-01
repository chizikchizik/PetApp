// Движок цикла: адаптивный прогноз (а не фиксированные 28 дней),
// вычисление фазы и дня, перименструальное окно риска мигрени.
// Чистые функции — тестируемы и не зависят от БД.

export type Phase = "menstrual" | "follicular" | "ovulatory" | "luteal";

export const PHASE_LABELS: Record<Phase, string> = {
  menstrual: "Менструальная",
  follicular: "Фолликулярная",
  ovulatory: "Овуляторная",
  luteal: "Лютеиновая",
};

const DAY = 86_400_000;
export const DEFAULT_MENSTRUAL_DAYS = 5; // приблизительная длительность менструации
const LUTEAL_LENGTH = 14; // лютеиновая фаза относительно постоянна
const RECENT_CYCLES = 12; // последние циклы для статистики

export function parseDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export interface CycleStats {
  avgLength: number;
  stdDev: number;
  recentLengths: number[];
}

/** Средняя длина и разброс по последним циклам (выбросы/пропуски отсекаются). */
export function cycleStats(starts: Date[]): CycleStats {
  const sorted = [...starts].sort((a, b) => a.getTime() - b.getTime());
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1], sorted[i]);
    if (len >= 15 && len <= 45) lengths.push(len);
  }
  const recent = lengths.slice(-RECENT_CYCLES);
  const n = recent.length || 1;
  const avg = recent.reduce((s, x) => s + x, 0) / n;
  const variance = recent.reduce((s, x) => s + (x - avg) ** 2, 0) / n;
  return { avgLength: avg, stdDev: Math.sqrt(variance), recentLengths: recent };
}

/** Фаза по дню цикла и средней длине. Овуляция ≈ длина − 14. */
export function phaseForDay(day: number, length: number, menstrualDays = DEFAULT_MENSTRUAL_DAYS): Phase {
  const ovulation = Math.max(12, Math.round(length) - LUTEAL_LENGTH);
  if (day <= menstrualDays) return "menstrual";
  if (day >= ovulation - 1 && day <= ovulation + 1) return "ovulatory";
  if (day < ovulation - 1) return "follicular";
  return "luteal";
}

export interface DateRange {
  earliest: Date;
  likely: Date;
  latest: Date;
}

export interface CycleInfo {
  cycleStart: Date;
  day: number;
  phase: Phase;
  stats: CycleStats;
  nextPeriod: DateRange;
  daysUntilNextPeriod: { min: number; likely: number; max: number };
  /** Перименструальное окно повышенного риска мигрени (−2…+3 от месячных). */
  migraineWindow: { start: Date; end: Date };
  inMigraineWindow: boolean;
}

export function getCurrentCycle(
  starts: Date[],
  today = new Date(),
  defaultLength = 28,
  menstrualDays = DEFAULT_MENSTRUAL_DAYS,
): CycleInfo {
  const sorted = [...starts].sort((a, b) => a.getTime() - b.getTime());
  const stats = cycleStats(sorted);
  const len = Math.round(stats.avgLength) || defaultLength;

  if (sorted.length === 0) {
    return {
      cycleStart: today,
      day: 1,
      phase: "follicular",
      stats,
      nextPeriod: { earliest: addDays(today, len - 1), likely: addDays(today, len), latest: addDays(today, len + 1) },
      daysUntilNextPeriod: { min: len - 1, likely: len, max: len + 1 },
      migraineWindow: { start: addDays(today, len - 2), end: addDays(today, len + 3) },
      inMigraineWindow: false,
    };
  }

  const cycleStart = sorted[sorted.length - 1];
  const day = daysBetween(cycleStart, today) + 1; // день 1 = старт менструации
  const phase = phaseForDay(day, len, menstrualDays);

  const likely = addDays(cycleStart, len);
  const spread = Math.max(1, Math.round(stats.stdDev));
  const nextPeriod: DateRange = {
    earliest: addDays(likely, -spread),
    likely,
    latest: addDays(likely, spread),
  };

  const migraineWindow = {
    start: addDays(likely, -2),
    end: addDays(likely, 3),
  };
  const inMigraineWindow =
    daysBetween(migraineWindow.start, today) >= 0 &&
    daysBetween(today, migraineWindow.end) >= 0;

  return {
    cycleStart,
    day,
    phase,
    stats,
    nextPeriod,
    daysUntilNextPeriod: {
      min: daysBetween(today, nextPeriod.earliest),
      likely: daysBetween(today, nextPeriod.likely),
      max: daysBetween(today, nextPeriod.latest),
    },
    migraineWindow,
    inMigraineWindow,
  };
}
