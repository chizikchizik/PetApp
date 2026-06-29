import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseDate } from "@/lib/cycle";
import * as seed from "@/lib/seed-data";

// Каждая функция пробует БД; при отсутствии ключей/данных или ошибке —
// возвращает значения из сида, чтобы экраны всегда работали.

export async function getPeriodStarts(): Promise<Date[]> {
  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("cycle_start")
      .select("start_date")
      .order("start_date", { ascending: true });
    if (!error && data && data.length) {
      return data.map((r: { start_date: string }) => parseDate(r.start_date));
    }
  }
  return seed.periodStarts();
}

export type WeightPoint = { date: string; actual: number };

export async function getRecentActualWeights(limit = 8): Promise<WeightPoint[]> {
  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("weight_entry")
      .select("entry_date, actual_kg")
      .not("actual_kg", "is", null)
      .order("entry_date", { ascending: false })
      .limit(limit);
    if (!error && data && data.length) {
      return data
        .map((r: { entry_date: string; actual_kg: number }) => ({
          date: r.entry_date,
          actual: Number(r.actual_kg),
        }))
        .reverse();
    }
  }
  return seed.WEIGHT.recent.map(([date, actual]) => ({ date, actual }));
}

export async function getCurrentWeight(): Promise<number> {
  // getRecentActualWeights возвращает по возрастанию даты → последний = самый свежий
  const w = await getRecentActualWeights(8);
  return w.length ? w[w.length - 1].actual : seed.WEIGHT.currentKg;
}

export const WEIGHT_GOAL = {
  kg: seed.WEIGHT.goalKg,
  startKg: seed.WEIGHT.startKg,
  dateISO: seed.WEIGHT.goalDateISO,
};

export async function getTriptanCount(ym: string): Promise<number> {
  const db = supabaseAdmin();
  if (db) {
    const [y, m] = ym.split("-").map(Number);
    const start = `${ym}-01`;
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    const { count, error } = await db
      .from("migraine_event")
      .select("*", { count: "exact", head: true })
      .eq("triptan", true)
      .gte("event_date", start)
      .lt("event_date", end);
    if (!error && typeof count === "number") return count;
  }
  return seed.MIGRAINE.triptanDaysByMonth[ym] ?? 0;
}

export type Med = { id: string; name: string; note: string; when: string; time: string };

export async function getMeds(): Promise<Med[]> {
  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("medication")
      .select("id, name, note, when_label, time_label")
      .order("sort", { ascending: true });
    if (!error && data && data.length) {
      return data.map(
        (r: {
          id: string;
          name: string;
          note: string | null;
          when_label: string | null;
          time_label: string | null;
        }) => ({
          id: r.id,
          name: r.name,
          note: r.note ?? "",
          when: r.when_label ?? "",
          time: r.time_label ?? "",
        }),
      );
    }
  }
  return seed.MEDS.map((m) => ({ ...m }));
}

export type HabitRow = { id: number; name: string; active: boolean };

export async function getHabits(): Promise<string[]> {
  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("habit")
      .select("name")
      .eq("active", true)
      .order("sort", { ascending: true });
    if (!error && data && data.length) {
      return data.map((r: { name: string }) => r.name);
    }
  }
  return [...seed.HABITS];
}

export async function getAllHabits(): Promise<HabitRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("habit")
    .select("id, name, active")
    .order("sort", { ascending: true });
  return (data ?? []) as HabitRow[];
}

export type DailyLog = {
  mood: number | null;
  energy: number | null;
  symptoms: string[];
  migraine: boolean;
  migraine_intensity: number | null;
  migraine_aura: boolean;
  migraine_triggers: string[];
  weight_kg: number | null;
  meds_taken: string[];
  habits_done: string[];
  sport_activities: string[] | null;
  note: string | null;
};

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("daily_log")
    .select("*")
    .eq("log_date", date)
    .maybeSingle();
  if (error || !data) return null;
  return data as DailyLog;
}

export type WeightRow = { date: string; plan: number | null; actual: number | null };

export async function getWeightEntries(): Promise<WeightRow[]> {
  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("weight_entry")
      .select("entry_date, plan_kg, actual_kg")
      .order("entry_date", { ascending: true });
    if (!error && data && data.length) {
      return data.map((r: { entry_date: string; plan_kg: number | null; actual_kg: number | null }) => ({
        date: r.entry_date,
        plan: r.plan_kg != null ? Number(r.plan_kg) : null,
        actual: r.actual_kg != null ? Number(r.actual_kg) : null,
      }));
    }
  }
  const fb: WeightRow[] = seed.WEIGHT.recent.map(([date, actual]) => ({ date, plan: null, actual }));
  fb.push({ date: seed.WEIGHT.goalDateISO, plan: seed.WEIGHT.goalKg, actual: null });
  return fb;
}

export type MigraineEvent = { date: string; aura: boolean; triptan: boolean };

export async function getMigraineEventsSince(sinceISO: string): Promise<MigraineEvent[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("migraine_event")
    .select("event_date, aura, triptan")
    .gte("event_date", sinceISO)
    .order("event_date", { ascending: true });
  if (error || !data) return [];
  return data.map((r: { event_date: string; aura: boolean; triptan: boolean }) => ({
    date: r.event_date,
    aura: r.aura,
    triptan: r.triptan,
  }));
}

export async function getMonthHabitStats(ym: string): Promise<{ done: number; daysLogged: number }> {
  const db = supabaseAdmin();
  if (!db) return { done: 0, daysLogged: 0 };
  const { data } = await db
    .from("daily_log")
    .select("habits_done")
    .gte("log_date", `${ym}-01`)
    .lte("log_date", `${ym}-31`);
  const rows = (data ?? []) as { habits_done: string[] | null }[];
  const done = rows.reduce((s, r) => s + (r.habits_done?.length ?? 0), 0);
  return { done, daysLogged: rows.length };
}

export type ExerciseTemplate = {
  order_index: number
  exercise_name: string
  exercise_slug?: string
  target_sets?: number
  target_reps?: string
  target_weight?: number
}

export type WorkoutTemplate = {
  id: string
  name: string
  type: string
  cycle_phase: string | null
  duration_min: number | null
  exercises: ExerciseTemplate[]
}

export type ScheduleDay = {
  id: string
  day_of_week: number
  workout_type: string | null
  workout_label: string | null
  template_id: string | null
  is_rest: boolean
  time_start: string | null
  duration_min: number | null
}

export type ActualExercise = {
  id: string
  exercise_name: string
  exercise_slug: string | null
  order_index: number
  target_sets: number | null
  target_reps: string | null
  target_weight: number | null
  actual_sets: number | null
  actual_reps: string | null
  actual_weight: number | null
  rpe: number | null
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const db = supabaseAdmin()
  if (!db) return []
  const { data } = await db.from("workout_template").select("*").eq("is_active", true).order("name")
  if (!data) return []
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    type: r.type as string,
    cycle_phase: r.cycle_phase as string | null,
    duration_min: r.duration_min as number | null,
    exercises: (r.exercises as ExerciseTemplate[]) ?? [],
  }))
}

export async function getWeeklySchedule(): Promise<ScheduleDay[]> {
  const db = supabaseAdmin()
  if (!db) return []
  const { data } = await db.from("weekly_schedule").select("*").eq("is_active", true).order("day_of_week")
  return (data ?? []) as ScheduleDay[]
}

export async function getWorkoutExercises(workoutId: string): Promise<ActualExercise[]> {
  const db = supabaseAdmin()
  if (!db) return []
  const { data } = await db.from("workout_exercise").select("*").eq("workout_id", workoutId).order("order_index")
  return (data ?? []) as ActualExercise[]
}
