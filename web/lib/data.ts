import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseDate } from "@/lib/cycle";
import { getCurrentUser } from "@/lib/auth";
import * as seed from "@/lib/seed-data";

// Returns the current user's UUID, "__legacy__", or null if not authenticated.
async function getAppUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// Apply per-user row filter to any Supabase query.
// Legacy users (old password cookie) filter by NULL; UUID users filter by their ID.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function byUser(q: any, uid: string | null): any {
  if (!uid || uid === "__legacy__") return q.is("app_user_id", null);
  return q.eq("app_user_id", uid);
}

// The app_user_id value to write on INSERT/UPSERT (null for legacy).
function toUid(uid: string | null): string | null {
  if (!uid || uid === "__legacy__") return null;
  return uid;
}

export async function getPeriodStarts(): Promise<Date[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("cycle_start").select("start_date").order("start_date", { ascending: true }),
      uid,
    );
    if (!error && data && data.length) {
      return data.map((r: { start_date: string }) => parseDate(r.start_date));
    }
    if (uid && uid !== "__legacy__") return [];
  }
  return seed.periodStarts();
}

export type WeightPoint = { date: string; actual: number };

export async function getRecentActualWeights(limit = 8): Promise<WeightPoint[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("weight_entry")
        .select("entry_date, actual_kg")
        .not("actual_kg", "is", null)
        .order("entry_date", { ascending: false })
        .limit(limit),
      uid,
    );
    if (!error && data && data.length) {
      return data
        .map((r: { entry_date: string; actual_kg: number }) => ({
          date: r.entry_date,
          actual: Number(r.actual_kg),
        }))
        .reverse();
    }
    if (uid && uid !== "__legacy__") return [];
  }
  return seed.WEIGHT.recent.map(([date, actual]) => ({ date, actual }));
}

export async function getCurrentWeight(): Promise<number> {
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
    const uid = await getAppUserId();
    const [y, m] = ym.split("-").map(Number);
    const start = `${ym}-01`;
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    const { count, error } = await byUser(
      db.from("migraine_event")
        .select("*", { count: "exact", head: true })
        .eq("triptan", true)
        .gte("event_date", start)
        .lt("event_date", end),
      uid,
    );
    if (!error && typeof count === "number") return count;
    if (uid && uid !== "__legacy__") return 0;
  }
  return seed.MIGRAINE.triptanDaysByMonth[ym] ?? 0;
}

export type Med = { id: string; name: string; note: string; when: string; habit_key: string };

export async function getMeds(): Promise<Med[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("medication")
        .select("id, name, note, when_label, habit_key")
        .order("sort", { ascending: true }),
      uid,
    );
    if (!error && data && data.length) {
      return data.map(
        (r: {
          id: string;
          name: string;
          note: string | null;
          when_label: string | null;
          habit_key: string | null;
        }) => ({
          id: r.id,
          name: r.name,
          note: r.note ?? "",
          when: r.when_label ?? "",
          habit_key: r.habit_key ?? r.name,
        }),
      );
    }
    if (uid && uid !== "__legacy__") return [];
  }
  return seed.MEDS.map((m) => ({ ...m, habit_key: m.name }));
}

export type HabitRow = {
  id: number;
  name: string;
  active: boolean;
  started_month: string | null;
  ended_month: string | null;
};

export async function getHabits(month?: string): Promise<string[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    let q = db.from("habit").select("name").eq("active", true).order("sort", { ascending: true });
    if (month) {
      q = q
        .or(`started_month.is.null,started_month.lte.${month}`)
        .or(`ended_month.is.null,ended_month.gte.${month}`);
    }
    const { data, error } = await byUser(q, uid);
    if (!error && data && data.length) {
      return data.map((r: { name: string }) => r.name);
    }
    // Real users with no habits yet get an empty list, not Marina's seed data
    if (uid && uid !== "__legacy__") return [];
  }
  return [...seed.HABITS];
}

export async function getAllHabits(): Promise<HabitRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db.from("habit")
      .select("id, name, active, started_month, ended_month")
      .order("sort", { ascending: true }),
    uid,
  );
  if (error) {
    const { data: d2 } = await byUser(
      db.from("habit").select("id, name, active").order("sort", { ascending: true }),
      uid,
    );
    return (d2 ?? []).map((r: { id: number; name: string; active: boolean }) => ({
      ...r,
      started_month: null,
      ended_month: null,
    }));
  }
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
  calorie_kcal: number | null;
};

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db.from("daily_log").select("*").eq("log_date", date).maybeSingle(),
    uid,
  );
  if (error || !data) return null;
  return data as DailyLog;
}

export type WeightRow = { date: string; plan: number | null; actual: number | null };

export async function getWeightEntries(): Promise<WeightRow[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("weight_entry")
        .select("entry_date, plan_kg, actual_kg")
        .order("entry_date", { ascending: true }),
      uid,
    );
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
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db.from("migraine_event")
      .select("event_date, aura, triptan")
      .gte("event_date", sinceISO)
      .order("event_date", { ascending: true }),
    uid,
  );
  if (error || !data) return [];
  return data.map((r: { event_date: string; aura: boolean; triptan: boolean }) => ({
    date: r.event_date,
    aura: r.aura,
    triptan: r.triptan,
  }));
}

export async function getAllMigraineEvents(): Promise<MigraineEvent[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db.from("migraine_event")
      .select("event_date, aura, triptan")
      .order("event_date", { ascending: true }),
    uid,
  );
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
  const uid = await getAppUserId();
  const { data } = await byUser(
    db.from("daily_log")
      .select("habits_done")
      .gte("log_date", `${ym}-01`)
      .lte("log_date", `${ym}-31`),
    uid,
  );
  const rows = (data ?? []) as { habits_done: string[] | null }[];
  const done = rows.reduce((s, r) => s + (r.habits_done?.length ?? 0), 0);
  return { done, daysLogged: rows.length };
}

export type CalorieEntry = { date: string; kcal: number };

export async function getCalorieEntries(): Promise<CalorieEntry[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db.from("daily_log")
      .select("log_date, calorie_kcal")
      .not("calorie_kcal", "is", null)
      .order("log_date", { ascending: true }),
    uid,
  );
  if (error || !data) return [];
  return (data as { log_date: string; calorie_kcal: number }[]).map((r) => ({
    date: r.log_date,
    kcal: r.calorie_kcal,
  }));
}

export type ExerciseTemplate = {
  order_index: number;
  exercise_name: string;
  exercise_slug?: string;
  target_sets?: number;
  target_reps?: string;
  target_weight?: number;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  type: string;
  cycle_phase: string | null;
  duration_min: number | null;
  exercises: ExerciseTemplate[];
};

export type ScheduleDay = {
  id: string;
  day_of_week: number;
  workout_type: string | null;
  workout_label: string | null;
  template_id: string | null;
  is_rest: boolean;
  time_start: string | null;
  duration_min: number | null;
};

export type ActualExercise = {
  id: string;
  exercise_name: string;
  exercise_slug: string | null;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: number | null;
  actual_sets: number | null;
  actual_reps: string | null;
  actual_weight: number | null;
  rpe: number | null;
};

// Global shared templates — no per-user filtering
export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db.from("workout_template").select("*").eq("is_active", true).order("name");
  if (!data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    type: r.type as string,
    cycle_phase: r.cycle_phase as string | null,
    duration_min: r.duration_min as number | null,
    exercises: (r.exercises as ExerciseTemplate[]) ?? [],
  }));
}

export async function getWeeklySchedule(): Promise<ScheduleDay[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db.from("weekly_schedule").select("*").eq("is_active", true).order("day_of_week");
  return (data ?? []) as ScheduleDay[];
}

export async function getWorkoutExercises(workoutId: string): Promise<ActualExercise[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("workout_exercise")
    .select("*")
    .eq("workout_id", workoutId)
    .order("order_index");
  return (data ?? []) as ActualExercise[];
}

export type WearableDay = {
  date: string;
  steps: number | null;
  tdee_kcal: number | null;
  hr_resting: number | null;
  spo2_avg: number | null;
  hrv_avg: number | null;
};

export async function getRecentWearableData(days = 28): Promise<WearableDay[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await byUser(
    db.from("daily_log")
      .select("log_date, steps, tdee_kcal, hr_resting, spo2_avg, hrv_avg")
      .gte("log_date", since.toISOString().slice(0, 10))
      .not("steps", "is", null)
      .order("log_date", { ascending: true }),
    uid,
  );
  if (error || !data) return [];
  return (data as Array<{
    log_date: string;
    steps: number | null;
    tdee_kcal: number | null;
    hr_resting: number | null;
    spo2_avg: number | null;
    hrv_avg: number | null;
  }>).map((r) => ({
    date: r.log_date,
    steps: r.steps,
    tdee_kcal: r.tdee_kcal,
    hr_resting: r.hr_resting,
    spo2_avg: r.spo2_avg,
    hrv_avg: r.hrv_avg,
  }));
}

export type SleepSession = {
  log_date: string;
  total_min: number | null;
  quality_pct: number | null;
  awake_min: number | null;
  rem_min: number | null;
  light_min: number | null;
  deep_min: number | null;
};

export async function getRecentSleepData(days = 28): Promise<SleepSession[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await db
    .from("sleep_log")
    .select("log_date, total_min, quality_pct, awake_min, rem_min, light_min, deep_min")
    .gte("log_date", since.toISOString().slice(0, 10))
    .order("log_date", { ascending: true });
  if (error || !data) return [];
  return data as SleepSession[];
}

export type WorkoutLogEntry = {
  date: string;
  type: string;
  duration_min: number | null;
  fatigue_pct: number | null;
};

export async function getWorkoutCountForYear(year: number): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const uid = await getAppUserId();
  const { count } = await byUser(
    db.from("workout_log")
      .select("id", { count: "exact", head: true })
      .gte("workout_date", `${year}-01-01`)
      .lte("workout_date", `${year}-12-31`),
    uid,
  );
  return count ?? 0;
}

export async function getWorkoutHistory(sinceISO: string): Promise<WorkoutLogEntry[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data } = await byUser(
    db.from("workout_log")
      .select("workout_date, type, duration_min, fatigue_pct")
      .gte("workout_date", sinceISO)
      .order("workout_date", { ascending: true }),
    uid,
  );
  return (data ?? []).map((r: { workout_date: string; type: string; duration_min: number | null; fatigue_pct: number | null }) => ({
    date: r.workout_date,
    type: r.type,
    duration_min: r.duration_min,
    fatigue_pct: r.fatigue_pct,
  }));
}

export type SportDay = {
  date: string;
  activities: string[];
};

export async function getSportActivityDays(sinceISO: string): Promise<SportDay[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data } = await byUser(
    db.from("daily_log")
      .select("log_date, sport_activities")
      .gte("log_date", sinceISO)
      .not("sport_activities", "is", null)
      .order("log_date", { ascending: true }),
    uid,
  );
  return (data ?? [])
    .filter((r: { sport_activities: string[] | null }) => (r.sport_activities?.length ?? 0) > 0)
    .map((r: { log_date: string; sport_activities: string[] }) => ({
      date: r.log_date,
      activities: r.sport_activities,
    }));
}

export type CycleHistoryRow = {
  start: string;
  length: number;
  migraineDays: number[];
};

export async function getCycleHistory(): Promise<CycleHistoryRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();

  const [{ data: starts }, { data: events }] = await Promise.all([
    byUser(
      db.from("cycle_start").select("start_date").order("start_date", { ascending: true }),
      uid,
    ),
    byUser(
      db.from("migraine_event").select("event_date").order("event_date", { ascending: true }),
      uid,
    ),
  ]);

  if (!starts?.length) return [];

  const toMs = (s: string) => new Date(s).getTime();
  const rows: CycleHistoryRow[] = [];

  for (let i = 0; i < starts.length; i++) {
    const startStr = starts[i].start_date as string;
    const nextStr = (starts[i + 1]?.start_date as string) ?? null;
    const startMs = toMs(startStr);
    const nextMs = nextStr ? toMs(nextStr) : null;
    const length = nextMs ? Math.round((nextMs - startMs) / 86400000) : 30;

    const migraineDays = (events ?? [])
      .filter((e: { event_date: string }) => {
        const eMs = toMs(e.event_date);
        return eMs >= startMs && (!nextMs || eMs < nextMs);
      })
      .map((e: { event_date: string }) => Math.round((toMs(e.event_date) - startMs) / 86400000) + 1);

    rows.push({ start: startStr, length, migraineDays });
  }

  return rows.reverse();
}
