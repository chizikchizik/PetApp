"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser, clearAuthCookie } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";

async function getUid(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.id === "__legacy__") throw new Error("Not authenticated");
  return user.id;
}

// Границы дублируют клиентскую валидацию из profile-form.tsx — server
// action публичный, границы должны стоять и на сервере (образец —
// saveBpReading). Вне диапазона → отказ, а не тихая запись мусора.
function outOfRange(v: number | null, min: number, max: number): boolean {
  return v != null && (!Number.isFinite(v) || v < min || v > max);
}

export async function saveProfile(input: {
  displayName: string;
  avgCycleLength: number | null;
  menstrualDays: number | null;
  weightGoalKg: number | null;
  weightStartKg: number | null;
  workoutYearGoal: number | null;
  calorieBalanceKcal: number | null;
  calorieGoalKcal: number | null;
}) {
  const uid = await getUid();
  const db = supabaseAdmin();
  if (!db) return { ok: false as const };

  if (
    outOfRange(input.avgCycleLength, 15, 60) ||
    outOfRange(input.menstrualDays, 1, 15) ||
    outOfRange(input.weightGoalKg, 30, 250) ||
    outOfRange(input.weightStartKg, 30, 250) ||
    outOfRange(input.workoutYearGoal, 1, 1000) ||
    outOfRange(input.calorieBalanceKcal, 800, 6000) ||
    outOfRange(input.calorieGoalKcal, 800, 6000)
  ) {
    return { ok: false as const };
  }

  const { error } = await db
    .from("app_user")
    .update({
      display_name: input.displayName.trim() || null,
      avg_cycle_length: input.avgCycleLength,
      menstrual_days: input.menstrualDays,
      weight_goal_kg: input.weightGoalKg,
      weight_start_kg: input.weightStartKg,
      workout_year_goal: input.workoutYearGoal,
      calorie_balance_kcal: input.calorieBalanceKcal,
      calorie_goal_kcal: input.calorieGoalKcal,
    })
    .eq("id", uid);

  return { ok: !error };
}

// Статус беременности — бинарный, системные даты (НЕ дата последней
// менструации: срок/триместры приложение сознательно не считает, см.
// ревью Елены). Выключение — одним действием, без вопросов и реакций.
export async function setPregnancy(on: boolean): Promise<{ ok: boolean }> {
  const uid = await getUid();
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const today = todayISOMoscow();

  if (!on) {
    const { error } = await db.from("app_user").update({ pregnant_until: today }).eq("id", uid);
    return { ok: !error };
  }

  // Включение: НЕ перезатираем pregnant_since, если оно уже стоит. Раньше
  // повторное включение (on→off→on) сбрасывало since на сегодня и теряло
  // прошлое окно [since; until] — приступы того безфазового периода снова
  // попадали в корреляцию мигрень×цикл. Две беременности в пределах
  // 365-дневного окна инсайтов биологически невозможны, поэтому сохранить
  // самую раннюю дату начала — всегда безопасный выбор (since нигде не
  // показывается пользователю — срок/недели не считаем).
  const { data } = await db
    .from("app_user")
    .select("pregnant_since")
    .eq("id", uid)
    .maybeSingle();
  const { error } = await db
    .from("app_user")
    .update({ pregnant_since: data?.pregnant_since ?? today, pregnant_until: null })
    .eq("id", uid);
  return { ok: !error };
}

export async function logout() {
  await clearAuthCookie();
  redirect("/login");
}
