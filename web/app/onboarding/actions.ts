"use server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { todayISOMoscow, isLoggableDay } from "@/lib/format";

// Действия онбординга возвращают { ok, error } вместо throw: в проде Next
// маскирует текст исключений из server actions, и пользовательница видела
// только «Ошибка» (QA раунд 8).
type Result = { ok: true } | { ok: false; error: string };

async function getUid(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || user.id === "__legacy__") return null;
  return user.id;
}

const NO_SESSION: Result = { ok: false, error: "Сессия истекла — войди заново" };
const NO_DB: Result = { ok: false, error: "Сервер недоступен, попробуй позже" };

export async function saveCycle(lastPeriodDate: string, cycleLength: number): Promise<Result> {
  const uid = await getUid();
  if (!uid) return NO_SESSION;
  const db = supabaseAdmin();
  if (!db) return NO_DB;
  if (!isLoggableDay(lastPeriodDate)) return { ok: false, error: "Проверь дату — она не может быть в будущем" };
  if (!Number.isInteger(cycleLength) || cycleLength < 15 || cycleLength > 60) {
    return { ok: false, error: "Длина цикла — от 15 до 60 дней" };
  }
  // Insert the most recent period start so the cycle engine has data
  const { error: e1 } = await db.from("cycle_start").upsert(
    { app_user_id: uid, start_date: lastPeriodDate },
    { onConflict: "app_user_id,start_date" }
  );
  // Store the self-reported average length as a fallback for getCurrentCycle()
  // until 2+ real cycle_start entries let it compute a real average.
  const { error: e2 } = await db.from("app_user").update({ avg_cycle_length: cycleLength }).eq("id", uid);
  return e1 || e2 ? { ok: false, error: "Не сохранилось, попробуй ещё раз" } : { ok: true };
}

function badKg(kg: number | null): boolean {
  return kg != null && (!Number.isFinite(kg) || kg < 30 || kg > 250);
}

export async function saveWeight(currentKg: number | null, goalKg: number | null): Promise<Result> {
  const uid = await getUid();
  if (!uid) return NO_SESSION;
  const db = supabaseAdmin();
  if (!db) return NO_DB;
  if (badKg(currentKg) || badKg(goalKg)) return { ok: false, error: "Вес — от 30 до 250 кг" };
  const { error } = await db.from("app_user").update({ weight_goal_kg: goalKg, weight_start_kg: currentKg }).eq("id", uid);
  if (error) return { ok: false, error: "Не сохранилось, попробуй ещё раз" };
  if (currentKg) {
    const today = todayISOMoscow();
    const { error: e2 } = await db.from("weight_entry").upsert(
      { app_user_id: uid, entry_date: today, actual_kg: currentKg },
      { onConflict: "app_user_id,entry_date" }
    );
    if (e2) return { ok: false, error: "Не сохранилось, попробуй ещё раз" };
  }
  return { ok: true };
}

export async function completeOnboarding(): Promise<Result> {
  const uid = await getUid();
  if (!uid) return NO_SESSION;
  const db = supabaseAdmin();
  if (!db) return NO_DB;
  const { error } = await db.from("app_user").update({ onboarding_done: true }).eq("id", uid);
  return error ? { ok: false, error: "Не сохранилось, попробуй ещё раз" } : { ok: true };
}

// Шаг «Что отслеживаешь» (миграция 060). Хотя бы один раздел обязателен.
export async function saveModules(tracks: { migraine: boolean; training: boolean; weight: boolean }): Promise<Result> {
  const uid = await getUid();
  if (!uid) return NO_SESSION;
  const db = supabaseAdmin();
  if (!db) return NO_DB;
  const t = { migraine: tracks.migraine === true, training: tracks.training === true, weight: tracks.weight === true };
  if (!t.migraine && !t.training && !t.weight) return { ok: false, error: "Выбери хотя бы один раздел" };
  const { error } = await db
    .from("app_user")
    .update({ track_migraine: t.migraine, track_training: t.training, track_weight: t.weight })
    .eq("id", uid);
  return error ? { ok: false, error: "Не сохранилось, попробуй ещё раз" } : { ok: true };
}
