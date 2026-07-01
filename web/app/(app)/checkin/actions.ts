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

export type CheckinPayload = {
  mood: number | null;
  energy: number | null;
  symptoms: string[];
  migraine: { had: boolean; intensity: number; aura: boolean; triggers: string[] };
  weight: string;
  kcal: string;
  meds: Record<string, boolean>;
  habits: string[];
  note: string;
};

export async function saveCheckin(
  dayKey: string,
  p: CheckinPayload,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase не настроен" };

  const uid = await getAppUserId();

  const row = {
    app_user_id: uid,
    log_date: dayKey,
    mood: p.mood,
    energy: p.energy,
    symptoms: p.symptoms,
    migraine: p.migraine.had,
    migraine_intensity: p.migraine.had ? p.migraine.intensity : null,
    migraine_aura: p.migraine.had ? p.migraine.aura : false,
    migraine_triggers: p.migraine.had ? p.migraine.triggers : [],
    weight_kg: p.weight ? Number(p.weight.replace(",", ".")) : null,
    calorie_kcal: p.kcal ? Math.round(Number(p.kcal.replace(",", "."))) : null,
    meds_taken: Object.entries(p.meds)
      .filter(([, v]) => v)
      .map(([k]) => k),
    habits_done: p.habits,
    note: p.note || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("daily_log")
    .upsert(row, { onConflict: "app_user_id,log_date" });
  if (error) return { ok: false, error: error.message };

  if (row.weight_kg != null) {
    await db.from("weight_entry").upsert(
      { entry_date: dayKey, actual_kg: row.weight_kg, app_user_id: uid },
      { onConflict: "app_user_id,entry_date" },
    );
  }

  revalidatePath("/weight");
  return { ok: true };
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
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Dose change = new version, not an in-place edit — old record is closed
// (ended_at = today) and a new one opens (started_at = today), so history
// of "what dose since when" stays intact for the /medical report.
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

  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMed(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  const { data, error } = await byUser(db.from("medication").delete().eq("id", id), uid).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Препарат не найден" };
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
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

  revalidatePath("/checkin");
  revalidatePath("/dashboard");
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
  revalidatePath("/checkin");
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
  revalidatePath("/checkin");
  return { ok: true };
}

export async function deleteMigraineTrigger(id: number): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(db.from("migraine_trigger").delete().eq("id", id), uid);
  if (error) return { ok: false };
  revalidatePath("/checkin");
  return { ok: true };
}
