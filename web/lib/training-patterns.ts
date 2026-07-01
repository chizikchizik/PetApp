import type { WorkoutLogEntry, MigraineEvent } from "@/lib/data";

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DOW_LABELS_GEN = ["понедельников", "вторников", "сред", "четвергов", "пятниц", "суббот", "воскресений"];

export type PatternState =
  | "no_workouts"    // 0 тренировок в окне
  | "too_few"        // < 10 тренировок — недостаточно для анализа
  | "no_migraines"   // тренировки есть, мигреней нет
  | "no_pattern"     // мигрени + тренировки, но связи нет
  | "postexertional"; // найден паттерн: день X → мигрень на день X+1/X+2

export type TrainingPattern =
  | { state: "no_workouts" }
  | { state: "too_few"; count: number }
  | { state: "no_migraines"; count: number; topDow: number; topDowLabel: string; topDowCount: number }
  | { state: "no_pattern"; count: number; migCount: number; overallRate: number }
  | {
      state: "postexertional";
      count: number;
      migCount: number;
      overallRate: number;
      peakDow: number;
      peakDowLabel: string;
      nextDowLabel: string;
      peakWorkouts: number;
      peakPostEx: number;
      peakRate: number;
      heaviestDow: number;
      heaviestDowLabel: string;
      showProtocol: boolean;
    };

function isoDow(dateISO: string): number {
  const d = new Date(dateISO + "T12:00:00");
  return (d.getDay() + 6) % 7; // 0=Пн … 6=Вс
}

function isoAddDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function computeTrainingPatterns(
  workouts: WorkoutLogEntry[],
  migraines: MigraineEvent[],
): TrainingPattern {
  const count = workouts.length;
  const migCount = migraines.length;

  if (count === 0) return { state: "no_workouts" };
  if (count < 10) return { state: "too_few", count };

  // Per-day-of-week: workout counts
  const workoutByDow = new Array(7).fill(0);
  for (const w of workouts) workoutByDow[isoDow(w.date)]++;
  const heaviestDow = workoutByDow.indexOf(Math.max(...workoutByDow));

  if (migCount === 0) {
    return {
      state: "no_migraines",
      count,
      topDow: heaviestDow,
      topDowLabel: DOW_LABELS[heaviestDow],
      topDowCount: workoutByDow[heaviestDow],
    };
  }

  // Build migraine date set
  const migSet = new Set(migraines.map((m) => m.date));

  // Per-workout: did a migraine occur 1 or 2 days later?
  let postExTotal = 0;
  const postExByDow = new Array(7).fill(0);

  for (const w of workouts) {
    const nextDay  = isoAddDays(w.date, 1);
    const nextDay2 = isoAddDays(w.date, 2);
    if (migSet.has(nextDay) || migSet.has(nextDay2)) {
      postExTotal++;
      postExByDow[isoDow(w.date)]++;
    }
  }

  const overallRate = Math.round((postExTotal / count) * 100);

  // Find day of week with highest postexertional rate (min 3 workouts to be significant)
  let peakDow = -1;
  let peakRate = 0;
  for (let i = 0; i < 7; i++) {
    if (workoutByDow[i] < 3) continue;
    const rate = postExByDow[i] / workoutByDow[i];
    if (rate > peakRate) { peakRate = rate; peakDow = i; }
  }

  const hasPeak = peakDow >= 0 && peakRate >= 0.30;
  const hasOverall = overallRate >= 20;

  if (!hasPeak && !hasOverall) {
    return { state: "no_pattern", count, migCount, overallRate };
  }

  // Use peak day if found, else heaviest day
  const useDow = hasPeak ? peakDow : heaviestDow;
  const nextDow = (useDow + 1) % 7;

  return {
    state: "postexertional",
    count,
    migCount,
    overallRate,
    peakDow: useDow,
    peakDowLabel: DOW_LABELS[useDow],
    nextDowLabel: DOW_LABELS[nextDow],
    peakWorkouts: workoutByDow[useDow],
    peakPostEx: postExByDow[useDow],
    peakRate: Math.round((postExByDow[useDow] / Math.max(workoutByDow[useDow], 1)) * 100),
    heaviestDow,
    heaviestDowLabel: DOW_LABELS[heaviestDow],
    showProtocol: migCount >= 3,
  };
}

export { DOW_LABELS, DOW_LABELS_GEN };
