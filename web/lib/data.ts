import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseDate } from "@/lib/cycle";
import { getCurrentUser } from "@/lib/auth";
import { isoDaysFromTodayMoscow } from "@/lib/format";
import { detectMedLabels } from "@/lib/migrebot-meds";
import * as seed from "@/lib/seed-data";
import { sportColor } from "@/lib/sport-colors";

// Returns the current user's UUID, "__legacy__", or null if not authenticated.
async function getAppUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// Нет сессии → фильтр, который не совпадёт ни с одной строкой (нулевой UUID
// никому не выдаётся). Раньше было is(null): запрос с поддельным cookie читал
// «ничейные» строки (QA раунд 8, P1-1).
const NO_USER = "00000000-0000-0000-0000-000000000000";

// PostgREST в этом проекте отдаёт максимум 1000 строк (max_rows), лишнее
// молча отрезается. Для выборок «за всё время» читаем постранично; запрос
// должен быть упорядочен, иначе страницы пересекаются.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows<T>(make: () => any, pageSize = 1000): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await make().range(from, from + pageSize - 1);
    if (error) return { data: out, error };
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) return { data: out, error: null };
  }
}

// Apply per-user row filter to any Supabase query.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function byUser(q: any, uid: string | null): any {
  if (!uid || uid === "__legacy__") return q.eq("app_user_id", NO_USER);
  return q.eq("app_user_id", uid);
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
    if (uid !== "__legacy__") return [];
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
    if (uid !== "__legacy__") return [];
  }
  return seed.WEIGHT.recent.map(([date, actual]) => ({ date, actual }));
}

// Returns null for a real registered user with no weight entries yet — must NOT
// fall back to Marina's seed weight, which getRecentActualWeights already guards
// against but this wrapper previously didn't.
// Фактический вес за конкретную дату (для «Сегодня» на прошлом дне —
// последние 30 взвешиваний могут её не включать).
export async function getWeightOn(dateISO: string): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const uid = await getAppUserId();
  if (!uid || uid === "__legacy__") return null;
  const { data } = await byUser(
    db.from("weight_entry").select("actual_kg").eq("entry_date", dateISO).not("actual_kg", "is", null),
    uid,
  ).maybeSingle();
  return data?.actual_kg != null ? Number(data.actual_kg) : null;
}

export async function getCurrentWeight(): Promise<number | null> {
  const uid = await getAppUserId();
  const w = await getRecentActualWeights(8);
  if (w.length) return w[w.length - 1].actual;
  if (uid !== "__legacy__") return null;
  return seed.WEIGHT.currentKg;
}

export const WEIGHT_GOAL = {
  kg: seed.WEIGHT.goalKg,
  startKg: seed.WEIGHT.startKg,
  dateISO: seed.WEIGHT.goalDateISO,
};

// ICHD-3 8.2 splits medication-overuse thresholds by drug class: triptans /
// ergots / opioids / combination analgesics ≥10 days/mo, simple analgesics
// (NSAID/paracetamol-mono) ≥15 days/mo. Only *as-needed* (abortive) intake
// counts — a preventive med taken daily (Амитриптилин) or a supplement
// (Витамины) can never enter this regardless of drug_class, so we filter on
// is_as_needed at the query level as a structural safeguard, not just by class.
// Reviewed with Elena (medical) — see feedback-dev-patterns memory.
type MedClassBuckets = { highRisk: Set<string>; nsaid: Set<string>; unclassified: Set<string> };

async function getAsNeededMedIdsByClass(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  uid: string | null,
): Promise<MedClassBuckets> {
  const { data } = await byUser(
    db.from("medication").select("id, drug_class").eq("is_as_needed", true),
    uid,
  );
  const highRisk = new Set<string>();
  const nsaid = new Set<string>();
  const unclassified = new Set<string>();
  for (const r of (data ?? []) as { id: string; drug_class: string | null }[]) {
    const cls = r.drug_class ?? "unclassified";
    if (cls === "triptan" || cls === "combination_analgesic" || cls === "ergot" || cls === "opioid") highRisk.add(r.id);
    else if (cls === "nsaid") nsaid.add(r.id);
    else if (cls === "unclassified") unclassified.add(r.id);
    // 'unsure'/'other' — user explicitly opted out of classification; excluded
    // from every counter and from the "needs review" nudge, on purpose.
  }
  return { highRisk, nsaid, unclassified };
}

// highRisk — дни приёма триптанов/комб. анальгетиков/эрготаминов/опиоидов
// (ориентир 10), nsaid — НПВС/простых анальгетиков (15), total — дни с любым
// из них: смешанный приём (ICHD-3 8.2.6) тоже считается с ориентиром 10.
export type MigraineMedStats = { highRisk: number; nsaid: number; total: number; unclassified: number };

const ZERO_STATS: MigraineMedStats = { highRisk: 0, nsaid: 0, total: 0, unclassified: 0 };

function ymAdd(ym: string, n: number): string {
  let [y, m] = ym.split("-").map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Счётчик МИГБ по месяцам за диапазон [fromYM; toYM] — двумя запросами на
// весь диапазон, а не по запросу на месяц.
export async function getMigraineMedStatsByMonth(fromYM: string, toYM: string): Promise<Record<string, MigraineMedStats>> {
  const months: string[] = [];
  for (let ym = fromYM; ym <= toYM; ym = ymAdd(ym, 1)) months.push(ym);
  const out: Record<string, MigraineMedStats> = Object.fromEntries(months.map((ym) => [ym, { ...ZERO_STATS }]));
  const db = supabaseAdmin();
  if (!db) return out;
  const uid = await getAppUserId();
  const start = `${fromYM}-01`;
  const end = `${ymAdd(toYM, 1)}-01`;

  // Legacy MigreBot-imported history only ever recorded a single triptan
  // flag — folded into the merged high-risk bucket for continuity.
  const [{ data: legacyRows }, classes] = await Promise.all([
    byUser(
      db.from("migraine_event")
        .select("event_date")
        .eq("triptan", true)
        .gte("event_date", start)
        .lt("event_date", end),
      uid,
    ),
    getAsNeededMedIdsByClass(db, uid),
  ]);
  const highRiskDays = new Set<string>((legacyRows ?? []).map((r: { event_date: string }) => r.event_date));
  const nsaidDays = new Set<string>();
  const unclassifiedDays = new Set<string>();

  const { highRisk, nsaid, unclassified } = classes;
  if (highRisk.size || nsaid.size || unclassified.size) {
    const { data: logRows } = await fetchAllRows<{ log_date: string; meds_taken: string[] | null }>(() => byUser(
      db.from("daily_log").select("log_date, meds_taken").gte("log_date", start).lt("log_date", end).order("log_date"),
      uid,
    ));
    for (const r of (logRows ?? []) as { log_date: string; meds_taken: string[] | null }[]) {
      const taken = r.meds_taken ?? [];
      if (taken.some((id) => highRisk.has(id))) highRiskDays.add(r.log_date);
      if (taken.some((id) => nsaid.has(id))) nsaidDays.add(r.log_date);
      if (taken.some((id) => unclassified.has(id))) unclassifiedDays.add(r.log_date);
    }
  }

  const bump = (days: Set<string>, key: keyof MigraineMedStats) => {
    for (const d of days) { const s = out[d.slice(0, 7)]; if (s) s[key]++; }
  };
  bump(highRiskDays, "highRisk");
  bump(nsaidDays, "nsaid");
  bump(unclassifiedDays, "unclassified");
  bump(new Set([...highRiskDays, ...nsaidDays]), "total");
  return out;
}

export async function getMigraineMedStats(ym: string): Promise<MigraineMedStats> {
  const uid = await getAppUserId();
  if (supabaseAdmin()) {
    const byMonth = await getMigraineMedStatsByMonth(ym, ym);
    return byMonth[ym] ?? { ...ZERO_STATS };
  }
  if (uid !== "__legacy__") return { ...ZERO_STATS };
  const legacy = seed.MIGRAINE.triptanDaysByMonth[ym] ?? 0;
  return { highRisk: legacy, nsaid: 0, total: legacy, unclassified: 0 };
}

export type Med = { id: string; name: string; note: string; when: string; habit_key: string; isAsNeeded: boolean; drugClass: string; isSupplement: boolean; kind: string; archived: boolean };

async function fetchMeds(includeArchived: boolean): Promise<Med[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    let q = db.from("medication")
      .select("id, name, note, when_label, habit_key, is_as_needed, drug_class, is_supplement, kind, archived_at")
      .is("ended_at", null)
      .order("sort", { ascending: true });
    if (!includeArchived) q = q.is("archived_at", null);
    const { data, error } = await byUser(q, uid);
    if (!error && data && data.length) {
      return data.map(
        (r: {
          id: string;
          name: string;
          note: string | null;
          when_label: string | null;
          habit_key: string | null;
          is_as_needed: boolean | null;
          drug_class: string | null;
          is_supplement: boolean | null;
          kind: string | null;
          archived_at: string | null;
        }) => ({
          id: r.id,
          name: r.name,
          note: r.note ?? "",
          when: r.when_label ?? "",
          habit_key: r.habit_key ?? r.name,
          isAsNeeded: r.is_as_needed ?? false,
          drugClass: r.drug_class ?? "unclassified",
          isSupplement: r.is_supplement ?? false,
          kind: r.kind ?? (r.is_supplement ? "supplement" : r.is_as_needed ? "as_needed" : "regular"),
          archived: r.archived_at != null,
        }),
      );
    }
    if (uid !== "__legacy__") return [];
  }
  return seed.MEDS.map((m) => ({ ...m, habit_key: m.name, isAsNeeded: false, drugClass: "unclassified", isSupplement: false, kind: "regular", archived: false }));
}

// Meds actively offered for new logging (checkin, habits management, etc).
export async function getMeds(): Promise<Med[]> {
  return fetchMeds(false);
}

// Every med including archived ones — for surfaces that must never lose
// history (the /checkin/meds heatmap, the habits history matrix, the
// neurologist report): "delete" only means "stop offering," never
// "forget it was ever taken."
export async function getAllMeds(): Promise<Med[]> {
  return fetchMeds(true);
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

// `triptan` here means "high-risk abortive taken" (triptan + combination
// analgesic + ergot + opioid, is_as_needed=true) — kept the field name for
// call-site compatibility (charts, correlation math), but it's the same
// merged bucket as the dashboard's МИГБ counter, not triptan-only.
export type MigraineEvent = { date: string; aura: boolean; triptan: boolean };

export async function getMigraineEventsSince(sinceISO: string): Promise<MigraineEvent[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const [{ data: evData }, { data: logData }, triptanIds] = await Promise.all([
    byUser(
      db.from("migraine_event")
        .select("event_date, aura, triptan")
        .gte("event_date", sinceISO)
        .order("event_date", { ascending: true }),
      uid,
    ),
    byUser(
      db.from("daily_log")
        .select("log_date, migraine_aura, meds_taken")
        .eq("migraine", true)
        .gte("log_date", sinceISO)
        .order("log_date", { ascending: true }),
      uid,
    ),
    getAsNeededMedIdsByClass(db, uid).then((b) => b.highRisk),
  ]);
  const seen = new Set<string>();
  const result: MigraineEvent[] = [];
  for (const r of (evData ?? [])) {
    seen.add(r.event_date);
    result.push({ date: r.event_date, aura: r.aura, triptan: r.triptan });
  }
  for (const r of (logData ?? []) as { log_date: string; migraine_aura: boolean | null; meds_taken: string[] | null }[]) {
    if (!seen.has(r.log_date)) {
      const triptan = (r.meds_taken ?? []).some((id) => triptanIds.has(id));
      result.push({ date: r.log_date, aura: r.migraine_aura ?? false, triptan });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAllMigraineEvents(): Promise<MigraineEvent[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const [{ data: evData }, { data: logData }, triptanIds] = await Promise.all([
    fetchAllRows<{ event_date: string; aura: boolean; triptan: boolean }>(() => byUser(
      db.from("migraine_event")
        .select("event_date, aura, triptan")
        .order("event_date", { ascending: true }),
      uid,
    )),
    fetchAllRows<{ log_date: string; migraine_aura: boolean | null; meds_taken: string[] | null }>(() => byUser(
      db.from("daily_log")
        .select("log_date, migraine_aura, meds_taken")
        .eq("migraine", true)
        .order("log_date", { ascending: true }),
      uid,
    )),
    getAsNeededMedIdsByClass(db, uid).then((b) => b.highRisk),
  ]);
  const seen = new Set<string>();
  const result: MigraineEvent[] = [];
  for (const r of evData) {
    seen.add(r.event_date);
    result.push({ date: r.event_date, aura: r.aura, triptan: r.triptan });
  }
  for (const r of (logData ?? []) as { log_date: string; migraine_aura: boolean | null; meds_taken: string[] | null }[]) {
    if (!seen.has(r.log_date)) {
      const triptan = (r.meds_taken ?? []).some((id) => triptanIds.has(id));
      result.push({ date: r.log_date, aura: r.migraine_aura ?? false, triptan });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
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

// ── Артериальное давление (домашний дневник: утро/вечер) ────────────────────
export type BpSlot = "morning" | "evening";
export type BpReading = {
  date: string;
  slot: BpSlot;
  systolic: number;
  diastolic: number;
  pulse: number | null;
};

export async function getBpReadings(sinceISO: string): Promise<BpReading[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db.from("bp_reading")
      .select("reading_date, slot, systolic, diastolic, pulse")
      .gte("reading_date", sinceISO)
      .order("reading_date", { ascending: true })
      .limit(2000),
    uid,
  );
  if (error || !data) return [];
  return (data as Array<{
    reading_date: string;
    slot: BpSlot;
    systolic: number;
    diastolic: number;
    pulse: number | null;
  }>).map((r) => ({
    date: r.reading_date,
    slot: r.slot,
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
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
    fetchAllRows<{ start_date: string }>(() => byUser(
      db.from("cycle_start").select("start_date").order("start_date", { ascending: true }),
      uid,
    )),
    fetchAllRows<{ event_date: string }>(() => byUser(
      db.from("migraine_event").select("event_date").order("event_date", { ascending: true }),
      uid,
    )),
    fetchAllRows<{ log_date: string }>(() => byUser(
      db.from("daily_log").select("log_date").eq("migraine", true).order("log_date", { ascending: true }),
      uid,
    )),
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
  // Циклы до первой записи о мигрени не показываем: история цикла бывает
  // длиннее истории приступов (например, цикл из FLO с 2018, мигрени с 2021),
  // и пустые строки только отодвигают нужное. Начинаем с цикла, в который
  // попал первый записанный приступ.
  const historyFrom = allMigDates.length ? allMigDates[0] : null;

  for (let i = 0; i < starts.length; i++) {
    const startStr = starts[i].start_date as string;
    const nextStr = (starts[i + 1]?.start_date as string) ?? null;
    if (historyFrom && nextStr && nextStr <= historyFrom) continue;
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

export const DEFAULT_SPORT_TYPES = ["Силовая", "Функциональная", "Бег", "Групповая"];
const LEGACY_SPORT_TYPES  = ["Силовая", "Функциональная", "Бег", "Волейбол", "Скайдайв", "Сноуборд", "Скалодром", "Групповая"];

function toSportTypes(names: string[]): SportType[] {
  return names.map((name, i) => ({ name, color: sportColor(i) }));
}

export async function getSportTypes(): Promise<SportType[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("sport_type").select("name, sort").order("sort", { ascending: true }),
      uid,
    );
    if (!error && data && data.length) {
      // Цвет — по постоянному номеру вида (sort), а не по месту в списке:
      // удаление вида не перекрашивает остальные. Новые виды получают
      // max(sort)+1, поэтому номера не повторяются.
      return (data as { name: string; sort: number | null }[]).map((r, i) => ({
        name: r.name,
        color: sportColor(typeof r.sort === "number" && r.sort >= 0 ? r.sort : i),
      }));
    }
    if (uid !== "__legacy__") return toSportTypes(DEFAULT_SPORT_TYPES);
  }
  return toSportTypes(LEGACY_SPORT_TYPES);
}

export type MigraineTrigger = { id: number; name: string };

export const DEFAULT_MIGRAINE_TRIGGERS = ["Цикл", "Сон", "Пропуск еды", "Стресс", "Экран", "Погода", "Алкоголь"];

// Список триггеров для выбора. Пока у пользовательницы нет своих строк (или
// таблицы нет — миграция 061 не применена), показываем стандартный список с
// отрицательными id: первое изменение списка сохранит его в таблицу.
export async function getMigraineTriggers(): Promise<MigraineTrigger[]> {
  const defaults = DEFAULT_MIGRAINE_TRIGGERS.map((name, i) => ({ id: -(i + 1), name }));
  const db = supabaseAdmin();
  if (!db) return defaults;
  const uid = await getAppUserId();
  if (!uid || uid === "__legacy__") return defaults;
  const { data, error } = await byUser(
    db.from("migraine_trigger").select("id, name").order("sort", { ascending: true }),
    uid,
  );
  if (error || !data || data.length === 0) return defaults;
  return data as MigraineTrigger[];
}

// One-off, occasional-pain logging (Iteration 1 of the medication rework) —
// deliberately separate from meds_taken/habits_done: these entries must
// never feed the МИГБ risk counter or adherence stats, only be visible in
// history. See migration 046.
export type QuickPainEntry = {
  id: string;
  logDate: string;
  painLocation: string | null;
  medId: string | null;
  medName: string | null;
  note: string | null;
};

export async function getQuickPainEntries(from: string, to: string): Promise<QuickPainEntry[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db
      .from("medication_intake")
      .select("id, log_date, pain_location, note, medication:medication_id(id, name)")
      .eq("purpose", "pain_other")
      .gte("log_date", from)
      .lte("log_date", to)
      .order("log_date", { ascending: false }),
    uid,
  );
  if (error || !data) return [];
  return data.map(
    (r: {
      id: string;
      log_date: string;
      pain_location: string | null;
      note: string | null;
      medication: { id: string; name: string } | { id: string; name: string }[] | null;
    }) => {
      const med = Array.isArray(r.medication) ? r.medication[0] : r.medication;
      return {
        id: r.id,
        logDate: r.log_date,
        painLocation: r.pain_location,
        medId: med?.id ?? null,
        medName: med?.name ?? null,
        note: r.note,
      };
    },
  );
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

  // 1. daily_log: new-style med logging + habit tracking, plus meds text
  // from the self-service MigreBot CSV importer (migrebot_meds_text — kept
  // separate from the free-text `note` column specifically so medication-
  // pattern detection never scans an unrelated personal note, see
  // migration 053).
  const { data: logData } = await byUser(
    db.from("daily_log")
      .select("log_date, meds_taken, habits_done, migraine, migrebot_meds_text")
      .gte("log_date", from)
      .lte("log_date", to),
    uid,
  );

  // 2. migraine_event: historical MigreBot data (meds column has medication text) —
  // only ever populated by one-off admin SQL imports, not by the self-service
  // importer (see migration 053's comment for why).
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
    migrebot_meds_text: string | null;
  }[]) {
    if (
      (r.meds_taken && r.meds_taken.length > 0) ||
      (r.habits_done && r.habits_done.length > 0) ||
      r.migraine ||
      r.migrebot_meds_text
    ) {
      byDate.set(r.log_date, {
        date: r.log_date,
        medIds: r.meds_taken ?? [],
        habitsDone: r.habits_done ?? [],
        migraine: r.migraine,
        migraineMeds: r.migrebot_meds_text,
      });
    }
  }

  for (const m of (migData ?? []) as { event_date: string; meds: string | null }[]) {
    const existing = byDate.get(m.event_date);
    if (existing) {
      existing.migraine = true;
      existing.migraineMeds = existing.migraineMeds ? `${existing.migraineMeds}; ${m.meds}` : m.meds;
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

// ── Дневник за месяц (в стиле MigreBot) ─────────────────────────────────────
// Один календарный месяц: какие дни отмечены (есть чек-ин / запись), в какие
// был приступ, в какие принимались купирующие препараты (и какие именно).
// Считается за один месяц — payload крошечный, навигация через /api/migre-diary.
export type MigreDiaryMonth = {
  ym: string;
  loggedDates: string[];                       // дни с любой записью (для ✓)
  migraineDates: string[];                     // дни с приступом
  medDays: { date: string; meds: string[] }[]; // дни приёма купирующих + препараты
  stats: MigraineMedStats;                     // счётчик МИГБ за месяц (дни приёма)
};

export async function getMigreDiaryMonth(ym: string): Promise<MigreDiaryMonth> {
  const empty: MigreDiaryMonth = { ym, loggedDates: [], migraineDates: [], medDays: [], stats: { highRisk: 0, nsaid: 0, total: 0, unclassified: 0 } };
  const db = supabaseAdmin();
  if (!db) return empty;
  if (!/^\d{4}-\d{2}$/.test(ym)) return empty;
  const uid = await getAppUserId();

  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${ym}-${String(lastDay).padStart(2, "0")}`;

  // Купирующие препараты — для резолва id/habit_key → название (включая архивные).
  const [meds, stats] = await Promise.all([getAllMeds(), getMigraineMedStats(ym)]);
  const asNeededById = new Map<string, string>();
  const asNeededByHabit = new Map<string, string>();
  for (const md of meds) {
    if (!md.isAsNeeded) continue;
    asNeededById.set(md.id, md.name);
    asNeededByHabit.set(md.habit_key, md.name);
  }

  const { data: logData } = await byUser(
    db.from("daily_log")
      .select("log_date, meds_taken, habits_done, migraine, migrebot_meds_text")
      .gte("log_date", from)
      .lte("log_date", to),
    uid,
  );
  const { data: migData } = await byUser(
    db.from("migraine_event")
      .select("event_date, meds")
      .gte("event_date", from)
      .lte("event_date", to),
    uid,
  );

  const logged = new Set<string>();
  const migraine = new Set<string>();
  const medsByDate = new Map<string, Set<string>>();
  const addMed = (date: string, name: string) => {
    if (!medsByDate.has(date)) medsByDate.set(date, new Set());
    medsByDate.get(date)!.add(name);
  };

  for (const r of (logData ?? []) as {
    log_date: string; meds_taken: string[] | null; habits_done: string[] | null;
    migraine: boolean; migrebot_meds_text: string | null;
  }[]) {
    logged.add(r.log_date);
    if (r.migraine) migraine.add(r.log_date);
    for (const id of r.meds_taken ?? []) {
      const n = asNeededById.get(id);
      if (n) addMed(r.log_date, n);
    }
    for (const hk of r.habits_done ?? []) {
      const n = asNeededByHabit.get(hk);
      if (n) addMed(r.log_date, n);
    }
    if (r.migrebot_meds_text) for (const label of detectMedLabels(r.migrebot_meds_text)) addMed(r.log_date, label);
  }

  for (const e of (migData ?? []) as { event_date: string; meds: string | null }[]) {
    logged.add(e.event_date);
    migraine.add(e.event_date);
    if (e.meds) for (const label of detectMedLabels(e.meds)) addMed(e.event_date, label);
  }

  return {
    ym,
    loggedDates: [...logged].sort(),
    migraineDates: [...migraine].sort(),
    medDays: [...medsByDate.entries()]
      .map(([date, s]) => ({ date, meds: [...s].sort() }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    stats,
  };
}
