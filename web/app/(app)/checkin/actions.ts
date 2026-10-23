"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";

async function getAppUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user || user.id === "__legacy__") return null;
    return user.id;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function byUser(q: any, uid: string | null): any {
  if (!uid) return q.is("app_user_id", null);
  return q.eq("app_user_id", uid);
}

export async function createMed(
  name: string,
  whenLabel: string | null,
  isAsNeeded = false,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Введи название" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();

  // If she's coming back to a medication she previously archived (see
  // deleteMed), reactivate that same row instead of creating a duplicate —
  // a new row would share the same habit_key and double up every day in
  // its history on the heatmap.
  const { data: archived } = await byUser(
    db.from("medication").select("id").eq("name", trimmed).not("archived_at", "is", null),
    uid,
  ).maybeSingle();
  if (archived) {
    const { error: restoreErr } = await byUser(
      db.from("medication").update({ archived_at: null }).eq("id", archived.id),
      uid,
    );
    if (restoreErr) return { ok: false, error: restoreErr.message };
    revalidatePath("/dashboard");
    revalidatePath("/checkin/meds");
    return { ok: true };
  }

  // Reject a duplicate of an already-active medication outright — without
  // this, a same-name insert silently creates a second row with its own id
  // and habit_key, splitting one medication's history/heatmap/МИГБ count in
  // two (found live on the admin account: two separate "Суматриптан" rows
  // from two create calls a day apart). The archived-reactivation case above
  // already covers the legitimate "adding it back" flow, so anything left
  // here really is a duplicate name, not a comeback.
  const { data: activeDup } = await byUser(
    db.from("medication").select("id").eq("name", trimmed).is("archived_at", null),
    uid,
  ).maybeSingle();
  if (activeDup) return { ok: false, error: "Такой препарат уже есть в списке" };

  const { error } = await db.from("medication").insert({
    id: `custom_${Date.now()}`,
    name: trimmed,
    when_label: isAsNeeded ? null : (whenLabel?.trim() || null),
    is_as_needed: isAsNeeded,
    sort: 99,
    habit_key: trimmed,
    app_user_id: uid,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

// Dose change = new version, not an in-place edit — old record is closed
// (ended_at = today) and a new one opens (started_at = today), so history
// of "what dose since when" stays intact for the neurologist report (/insights/report).
export async function changeMedDose(
  oldId: string,
  newName: string,
  newNote: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, error: "Введи название" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  const today = todayISOMoscow();

  const { data: old, error: fetchErr } = await byUser(
    db.from("medication").select("habit_key, is_as_needed, when_label, sort").eq("id", oldId),
    uid,
  ).maybeSingle();
  if (fetchErr || !old) return { ok: false, error: "Препарат не найден" };

  const { error: closeErr } = await byUser(
    db.from("medication").update({ ended_at: today }).eq("id", oldId),
    uid,
  );
  if (closeErr) return { ok: false, error: closeErr.message };

  const { error: insertErr } = await db.from("medication").insert({
    id: `custom_${Date.now()}`,
    name: trimmed,
    note: newNote.trim() || null,
    when_label: old.when_label,
    is_as_needed: old.is_as_needed,
    habit_key: old.habit_key,
    sort: old.sort,
    started_at: today,
    app_user_id: uid,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

// Soft delete — sets archived_at instead of removing the row. History
// (habit_key/id matches in daily_log, name matches against migraine_event
// text) is looked up dynamically against the medication row, not stored
// per-entry, so a hard delete would silently erase past intake from every
// heatmap/report. Archiving just stops it being offered for new logging.
export async function deleteMed(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  const { data, error } = await byUser(
    db.from("medication").update({ archived_at: new Date().toISOString() }).eq("id", id),
    uid,
  ).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Препарат не найден" };
  revalidatePath("/dashboard");
  revalidatePath("/checkin/meds");
  revalidatePath("/insights/report");
  return { ok: true };
}

// Valid drug_class values: triptan, nsaid, combination_analgesic, ergot,
// opioid — count toward the МИГБ risk counters; 'unsure'/'other' explicitly
// opt out (no nag, no count); 'unclassified' is the not-yet-reviewed default.
export async function setMedDrugClass(medId: string, drugClass: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(db.from("medication").update({ drug_class: drugClass }).eq("id", medId), uid);
  if (error) return { ok: false };
  revalidatePath("/dashboard");
  revalidatePath("/checkin/meds");
  return { ok: true };
}

// One-tap logging for use mid-attack: just flags migraine=true for the day,
// preserving whatever else is already in the row. Details (intensity, aura,
// triggers, meds) can be filled in later via the full checkin form — asking
// for all of that up front when someone feels terrible is the whole problem.
export async function quickLogMigraine(dayKey: string): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();

  const { data: existing } = await byUser(
    db.from("daily_log").select("*").eq("log_date", dayKey),
    uid,
  ).maybeSingle();

  const { id: _id, ...base } = (existing ?? {}) as Record<string, unknown>;
  const row = {
    ...base,
    app_user_id: uid,
    log_date: dayKey,
    migraine: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db.from("daily_log").upsert(row, { onConflict: "app_user_id,log_date" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

// Quick log for occasional non-migraine pain (Iteration 1, see migration 046).
// Writes only to medication_intake — deliberately does NOT touch
// meds_taken/habits_done, so it can never inflate the МИГБ counter or
// adherence stats. medId is optional: often there's no medication to log,
// just "stomach hurt, did nothing about it".
export async function logQuickPain(
  dayKey: string,
  painLocation: string,
  medId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();

  // medId comes straight from the client (this server action is a public
  // endpoint) — without checking ownership here, passing someone else's
  // medication id would insert a row that later joins to *their* medication
  // name in getQuickPainEntries(), leaking it into this user's own history.
  if (medId) {
    const { data: owned } = await byUser(
      db.from("medication").select("id").eq("id", medId),
      uid,
    ).maybeSingle();
    if (!owned) return { ok: false, error: "Препарат не найден" };
  }

  const { error } = await db.from("medication_intake").insert({
    app_user_id: uid,
    medication_id: medId,
    log_date: dayKey,
    purpose: "pain_other",
    pain_location: painLocation,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/checkin/meds");
  return { ok: true };
}

export async function savePeriodStart(dateISO: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await db
    .from("cycle_start")
    .upsert({ start_date: dateISO, app_user_id: uid }, { onConflict: "app_user_id,start_date" });
  if (error) return { ok: false };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addMigraineTrigger(name: string): Promise<{ ok: boolean }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false };
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { data: existing } = await byUser(
    db.from("migraine_trigger").select("id").ilike("name", trimmed).limit(1),
    uid,
  );
  if (existing && existing.length > 0) return { ok: true };
  const { data: maxSort } = await byUser(
    db.from("migraine_trigger").select("sort").order("sort", { ascending: false }).limit(1),
    uid,
  );
  const nextSort = (maxSort?.[0]?.sort ?? 0) + 1;
  await byUser(
    db.from("migraine_trigger").insert({ name: trimmed, sort: nextSort, app_user_id: uid }),
    uid,
  );
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMigraineTrigger(id: number): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(db.from("migraine_trigger").delete().eq("id", id), uid);
  if (error) return { ok: false };
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Точечные правки дня для экрана «Сегодня» ──
// Каждое действие перечитывает строку daily_log и меняет только свои поля.
// Сохранять всю форму целиком на каждое касание нельзя: устаревшее
// состояние клиента затёрло бы то, что параллельно пишут другие действия
// (например, «Спорт»/«Бег» в habits_done от записи тренировки).

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDay(dayKey: string): boolean {
  return DAY_RE.test(dayKey) && dayKey <= todayISOMoscow();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function patchDay(db: any, uid: string | null, dayKey: string, patch: (row: Record<string, unknown>) => Record<string, unknown>) {
  const { data: existing, error: readErr } = await byUser(
    db.from("daily_log").select("*").eq("log_date", dayKey),
    uid,
  ).maybeSingle();
  if (readErr) return { ok: false, error: readErr.message as string };
  const { id: _id, ...base } = (existing ?? {}) as Record<string, unknown>;
  const row = {
    ...base,
    ...patch(base),
    app_user_id: uid,
    log_date: dayKey,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("daily_log").upsert(row, { onConflict: "app_user_id,log_date" });
  if (error) return { ok: false, error: error.message as string };
  return { ok: true };
}

function revalidateDay() {
  revalidatePath("/dashboard");
  revalidatePath("/checkin/meds");
  revalidatePath("/insights");
}

// Отметка приёма препарата: id в meds_taken и habit_key в habits_done
// (на втором держится история регулярных препаратов и витаминов).
export async function setMedTaken(
  dayKey: string,
  medId: string,
  on: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!validDay(dayKey)) return { ok: false, error: "Неверная дата" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();

  // medId приходит с клиента — проверяем, что препарат принадлежит ей.
  const { data: med } = await byUser(
    db.from("medication").select("id, name, habit_key").eq("id", medId),
    uid,
  ).maybeSingle();
  if (!med) return { ok: false, error: "Препарат не найден" };
  const habitKey: string = med.habit_key ?? med.name;

  const res = await patchDay(db, uid, dayKey, (row) => {
    const meds = new Set((row.meds_taken as string[] | null) ?? []);
    const habits = new Set((row.habits_done as string[] | null) ?? []);
    if (on) { meds.add(medId); habits.add(habitKey); }
    else { meds.delete(medId); habits.delete(habitKey); }
    return { meds_taken: [...meds], habits_done: [...habits] };
  });
  if (res.ok) revalidateDay();
  return res;
}

export async function saveMigraineDetails(
  dayKey: string,
  m: { had: boolean; intensity: number; aura: boolean; triggers: string[] },
): Promise<{ ok: boolean; error?: string }> {
  if (!validDay(dayKey)) return { ok: false, error: "Неверная дата" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  const intensity = Math.round(Number(m.intensity));
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 10) return { ok: false, error: "Сила — от 0 до 10" };
  const triggers = Array.isArray(m.triggers) ? m.triggers.filter((t) => typeof t === "string").slice(0, 30) : [];

  const res = await patchDay(db, uid, dayKey, () => ({
    migraine: m.had === true,
    migraine_intensity: m.had ? intensity : null,
    migraine_aura: m.had ? m.aura === true : false,
    migraine_triggers: m.had ? triggers : [],
  }));
  if (res.ok) revalidateDay();
  return res;
}

// Вес и калории за день. Пустое значение очищает поле; для веса заодно
// снимаем фактический вес в weight_entry (план на эту дату не трогаем),
// чтобы «Сегодня» и «Вес» показывали одно и то же.
export async function saveDayNumber(
  dayKey: string,
  field: "weight" | "kcal",
  raw: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!validDay(dayKey)) return { ok: false, error: "Неверная дата" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();

  const trimmed = raw.trim().replace(",", ".");
  const value = trimmed === "" ? null : Number(trimmed);
  if (value != null) {
    if (!Number.isFinite(value)) return { ok: false, error: "Нужно число" };
    if (field === "weight" && (value < 25 || value > 300)) return { ok: false, error: "Вес — от 25 до 300 кг" };
    if (field === "kcal" && (value < 0 || value > 15000)) return { ok: false, error: "Калории — от 0 до 15 000" };
  }

  const column = field === "weight" ? "weight_kg" : "calorie_kcal";
  const stored = value == null ? null : field === "kcal" ? Math.round(value) : Math.round(value * 10) / 10;
  const res = await patchDay(db, uid, dayKey, () => ({ [column]: stored }));
  if (!res.ok) return res;

  if (field === "weight") {
    if (stored != null) {
      await db.from("weight_entry").upsert(
        { entry_date: dayKey, actual_kg: stored, app_user_id: uid },
        { onConflict: "app_user_id,entry_date" },
      );
    } else {
      await byUser(
        db.from("weight_entry").update({ actual_kg: null }).eq("entry_date", dayKey),
        uid,
      );
    }
  }
  revalidatePath("/dashboard");
  revalidatePath("/weight");
  return { ok: true };
}
