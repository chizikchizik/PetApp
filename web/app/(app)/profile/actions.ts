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
  const { error } = await db
    .from("app_user")
    .update(on ? { pregnant_since: today, pregnant_until: null } : { pregnant_until: today })
    .eq("id", uid);
  return { ok: !error };
}

export async function logout() {
  await clearAuthCookie();
  redirect("/login");
}
