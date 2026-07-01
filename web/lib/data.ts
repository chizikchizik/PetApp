import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseDate } from "@/lib/cycle";
import { getCurrentUser } from "@/lib/auth";
import { isoDaysFromTodayMoscow } from "@/lib/format";
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

// Returns null for a real registered user with no weight entries yet — must NOT
// fall back to Marina's seed weight, which getRecentActualWeights already guards
// against but this wrapper previously didn't.
export async function getCurrentWeight(): Promise<number | null> {
  const uid = await getAppUserId();
  const w = await getRecentActualWeights(8);
  if (w.length) return w[w.length - 1].actual;
  if (uid && uid !== "__legacy__") return null;
  return seed.WEIGHT.currentKg;
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

export type Med = { id: string; name: string; note: string; when: string; habit_key: string; isAsNeeded: boolean };

export async function getMeds(): Promise<Med[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("medication")
        .select("id, name, note, when_label, habit_key, is_as_needed")
        .is("ended_at", null)
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
          is_as_needed: boolean | null;
        }) => ({
          id: r.id,
          name: r.name,
          note: r.note ?? "",
          when: r.when_label ?? "",
          habit_key: r.habit_key ?? r.name,
          isAsNeeded: r.is_as_needed ?? false,
        }),
      );
    }
    if (uid && uid !== "__legacy__") return [];
  }
  return seed.MEDS.map((m) => ({ ...m, habit_key: m.name, isAsNeeded: false }));
}

export type MedVersion = {
  id: string;
  name: string;
  note: string;
  startedAt: string;
  endedAt: string | null;
};

// Full dose history (active + past versions) for a given habit_key — used to
// show "Топирамат 25мг — с 1 марта по 14 июня, Топирамат 50мг — с 15 июня".
export async function getMedDoseHistory(habitKey: string): Promise<MedVersion[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data } = await byUser(
    db.from("medication")
      .select("id, name, note, started_at, ended_at")
      .eq("habit_key", habitKey)
      .order("started_at", { ascending: true }),
    uid,
  );
  return ((data ?? []) as Array<{ id: string; name: string; note: string | null; started_at: string; ended_at: string | null }>).map(
    (r) => ({ id: r.id, name: r.name, note: r.note ?? "", startedAt: r.started_at, endedAt: r.ended_at }),
  );
}

// Count of daily_log entries where each med id appears in meds_taken, for a given month.
export async function getMedMonthlyCounts(ym: string): Promise<Record<string, number>> {
  const db = supabaseAdmin();
  if (!db) return {};
  const uid = await getAppUserId();
  const start = `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  const { data } = await byUser(
    db.from("daily_log").select("meds_taken").gte("log_date", start).lt("log_date", end),
    uid,
  );
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ meds_taken: string[] | null }>) {
    for (const id of row.meds_taken ?? []) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
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
  const { data } = await byUser(
    db.from("habit")
      .select("id, name, active, started_month, ended_month")
      .order("sort", { ascending: true }),
    uid,
  );
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
  const [{ data: evData }, { data: logData }] = await Promise.all([
    byUser(
      db.from("migraine_event")
        .select("event_date, aura, triptan")
        .gte("event_date", sinceISO)
        .order("event_date", { ascending: true }),
      uid,
    ),
    byUser(
      db.from("daily_log")
        .select("log_date, migraine_aura")
        .eq("migraine", true)
        .gte("log_date", sinceISO)
        .order("log_date", { ascending: true }),
      uid,
    ),
  ]);
  const seen = new Set<string>();
  const result: MigraineEvent[] = [];
  for (const r of (evData ?? [])) {
    seen.add(r.event_date);
    result.push({ date: r.event_date, aura: r.aura, triptan: r.triptan });
  }
  for (const r of (logData ?? [])) {
    if (!seen.has(r.log_date)) {
      result.push({ date: r.log_date, aura: r.migraine_aura ?? false, triptan: false });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAllMigraineEvents(): Promise<MigraineEvent[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const [{ data: evData }, { data: logData }] = await Promise.all([
    byUser(
      db.from("migraine_event")
        .select("event_date, aura, triptan")
        .order("event_date", { ascending: true }),
      uid,
    ),
    byUser(
      db.from("daily_log")
        .select("log_date, migraine_aura")
        .eq("migraine", true)
        .order("log_date", { ascending: true }),
      uid,
    ),
  ]);
  const seen = new Set<string>();
  const result: MigraineEvent[] = [];
  for (const r of (evData ?? [])) {
    seen.add(r.event_date);
    result.push({ date: r.event_date, aura: r.aura, triptan: r.triptan });
  }
  for (const r of (logData ?? [])) {
    if (!seen.has(r.log_date)) {
      result.push({ date: r.log_date, aura: r.migraine_aura ?? false, triptan: false });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getMonthHabitStats(ym: string): Promise<{ done: number; daysLogged: number }> {
  const db = supabaseAdmin();
  if (!db) return { done: 0, daysLogged: 0 };
  const uid = await getAppUserId();
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  const { data, error } = await byUser(
    db.from("daily_log")
      .select("habits_done")
      .gte("log_date", start)
      .lt("log_date", end),
    uid,
  );
  if (error) return { done: 0, daysLogged: 0 };
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

// Templates are shared: seed rows have app_user_id IS NULL, plus any user's own custom templates.
export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const query = db.from("workout_template").select("*").eq("is_active", true).order("name");
  const { data } = uid
    ? await query.or(`app_user_id.is.null,app_user_id.eq.${uid}`)
    : await query.is("app_user_id", null);
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

// Same "shared" pattern as getWorkoutTemplates: seed rows with app_user_id IS NULL
// (if any exist) are visible to every user, plus each user's own schedule entries.
export async function getWeeklySchedule(): Promise<ScheduleDay[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const query = db.from("weekly_schedule").select("*").eq("is_active", true).order("day_of_week");
  const { data } = uid
    ? await query.or(`app_user_id.is.null,app_user_id.eq.${uid}`)
    : await query.is("app_user_id", null);
  return (data ?? []) as ScheduleDay[];
}

export async function getWorkoutExercises(workoutId: string): Promise<ActualExercise[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();

  // workout_exercise has no app_user_id column — verify ownership via workout_log first.
  const { data: owned } = await byUser(
    db.from("workout_log").select("id").eq("id", workoutId),
    uid,
  ).maybeSingle();
  if (!owned) return [];

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
  const sinceISO = isoDaysFromTodayMoscow(-days);
  const { data, error } = await byUser(
    db.from("daily_log")
      .select("log_date, steps, tdee_kcal, hr_resting, spo2_avg, hrv_avg")
      .gte("log_date", sinceISO)
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
  const uid = await getAppUserId();
  const sinceISO = isoDaysFromTodayMoscow(-days);
  const { data, error } = await byUser(
    db.from("sleep_log")
      .select("log_date, total_min, quality_pct, awake_min, rem_min, light_min, deep_min")
      .gte("log_date", sinceISO)
      .order("log_date", { ascending: true }),
    uid,
  );
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

  const [{ data: starts }, { data: events }, { data: logEvents }] = await Promise.all([
    byUser(
      db.from("cycle_start").select("start_date").order("start_date", { ascending: true }),
      uid,
    ),
    byUser(
      db.from("migraine_event").select("event_date").order("event_date", { ascending: true }),
      uid,
    ),
    byUser(
      db.from("daily_log").select("log_date").eq("migraine", true).order("log_date", { ascending: true }),
      uid,
    ),
  ]);

  if (!starts?.length) return [];

  // Merge migraine dates from both sources
  const seen = new Set<string>();
  const allMigDates: string[] = [];
  for (const e of (events ?? [])) { seen.add(e.event_date); allMigDates.push(e.event_date); }
  for (const e of (logEvents ?? [])) { if (!seen.has(e.log_date)) allMigDates.push(e.log_date); }
  allMigDates.sort();

  const toMs = (s: string) => new Date(s).getTime();
  const rows: CycleHistoryRow[] = [];

  for (let i = 0; i < starts.length; i++) {
    const startStr = starts[i].start_date as string;
    const nextStr = (starts[i + 1]?.start_date as string) ?? null;
    const startMs = toMs(startStr);
    const nextMs = nextStr ? toMs(nextStr) : null;
    const length = nextMs ? Math.round((nextMs - startMs) / 86400000) : 30;

    const migraineDays = allMigDates
      .filter((d) => {
        const eMs = toMs(d);
        return eMs >= startMs && (!nextMs || eMs < nextMs);
      })
      .map((d) => Math.round((toMs(d) - startMs) / 86400000) + 1);

    rows.push({ start: startStr, length, migraineDays });
  }

  return rows.reverse();
}

// ── Sport types with palette colors ──────────────────────────────────────────

export type SportType = { name: string; color: string };

// 8 distinct colors that look good on dark backgrounds (VERTA palette)
export const SPORT_PALETTE = [
  "#e8a23a",  // янтарный   — сила, зал
  "#4a8fe8",  // синий      — команда, волейбол
  "#8f5ec8",  // фиолетовый — групповые, скалодром
  "#d05a30",  // оранж-кр   — бег, HIIT
  "#4fa85a",  // зелёный    — ходьба, природа
  "#2aa09a",  // бирюзовый  — бассейн, функциональная
  "#d4a030",  // золотой    — сноуборд, скайдайв
  "#c85e88",  // розовый    — пилатес, танцы
];

const DEFAULT_SPORT_TYPES = ["Силовая", "Функциональная", "Бег", "Групповая"];
const LEGACY_SPORT_TYPES  = ["Силовая", "Функциональная", "Бег", "Волейбол", "Скайдайв", "Сноуборд", "Скалодром", "Групповая"];

function toSportTypes(names: string[]): SportType[] {
  return names.map((name, i) => ({ name, color: SPORT_PALETTE[i % SPORT_PALETTE.length] }));
}

export async function getSportTypes(): Promise<SportType[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("sport_type").select("name").order("sort", { ascending: true }),
      uid,
    );
    if (!error && data && data.length) {
      return toSportTypes(data.map((r: { name: string }) => r.name));
    }
    if (uid && uid !== "__legacy__") return toSportTypes(DEFAULT_SPORT_TYPES);
  }
  return toSportTypes(LEGACY_SPORT_TYPES);
}

export type MedIntakeDay = {
  date: string;
  medIds: string[];
  habitsDone: string[];
  migraine: boolean;
  migraineMeds: string | null; // meds text from migraine_event (MigreBot history)
};

export async function getMedIntakeDays(from: string, to: string): Promise<MedIntakeDay[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();

  // 1. daily_log: new-style med logging + habit tracking
  const { data: logData } = await byUser(
    db.from("daily_log")
      .select("log_date, meds_taken, habits_done, migraine")
      .gte("log_date", from)
      .lte("log_date", to),
    uid,
  );

  // 2. migraine_event: historical MigreBot data (meds column has medication text)
  const { data: migData } = await byUser(
    db.from("migraine_event")
      .select("event_date, meds")
      .gte("event_date", from)
      .lte("event_date", to)
      .not("meds", "is", null),
    uid,
  );

  // Merge into a map keyed by date
  const byDate = new Map<string, MedIntakeDay>();

  for (const r of (logData ?? []) as {
    log_date: string;
    meds_taken: string[] | null;
    habits_done: string[] | null;
    migraine: boolean;
  }[]) {
    if (
      (r.meds_taken && r.meds_taken.length > 0) ||
      (r.habits_done && r.habits_done.length > 0) ||
      r.migraine
    ) {
      byDate.set(r.log_date, {
        date: r.log_date,
        medIds: r.meds_taken ?? [],
        habitsDone: r.habits_done ?? [],
        migraine: r.migraine,
        migraineMeds: null,
      });
    }
  }

  for (const m of (migData ?? []) as { event_date: string; meds: string | null }[]) {
    const existing = byDate.get(m.event_date);
    if (existing) {
      existing.migraine = true;
      existing.migraineMeds = m.meds;
    } else {
      byDate.set(m.event_date, {
        date: m.event_date,
        medIds: [],
        habitsDone: [],
        migraine: true,
        migraineMeds: m.meds,
      });
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
