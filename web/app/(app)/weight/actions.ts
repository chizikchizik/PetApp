"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

export async function saveWeight(
  dateISO: string,
  kg: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase не настроен" };
  const uid = await getAppUserId();
  const { error } = await db
    .from("weight_entry")
    .upsert(
      { entry_date: dateISO, actual_kg: kg, app_user_id: uid },
      { onConflict: "app_user_id,entry_date" },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

// План похудения — ломаная линия по точкам "к этой дате хочу весить N кг".
// Точки живут в том же weight_entry.plan_kg (график уже соединяет их
// polyline'ом в порядке дат) — отдельная таблица не нужна.
export async function savePlanPoint(
  dateISO: string,
  kg: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase не настроен" };
  const uid = await getAppUserId();
  const { error } = await db
    .from("weight_entry")
    .upsert(
      { entry_date: dateISO, plan_kg: kg, app_user_id: uid },
      { onConflict: "app_user_id,entry_date" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/weight");
  return { ok: true };
}

// Не удаляем строку целиком — в ней может жить actual_kg за тот же день.
export async function deletePlanPoint(
  dateISO: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase не настроен" };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("weight_entry").update({ plan_kg: null }).eq("entry_date", dateISO),
    uid,
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/weight");
  return { ok: true };
}

export async function saveCalories(
  dateISO: string,
  kcal: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase не настроен" };
  const uid = await getAppUserId();
  const ts = new Date().toISOString();

  const { data: existing } = await byUser(
    db.from("daily_log").select("log_date").eq("log_date", dateISO),
    uid,
  ).maybeSingle();

  const { error } = existing
    ? await byUser(
        db.from("daily_log").update({ calorie_kcal: kcal, updated_at: ts }).eq("log_date", dateISO),
        uid,
      )
    : await db.from("daily_log").insert({
        log_date: dateISO,
        calorie_kcal: kcal,
        habits_done: [],
        meds_taken: [],
        updated_at: ts,
        app_user_id: uid,
      });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/weight");
  return { ok: true };
}
