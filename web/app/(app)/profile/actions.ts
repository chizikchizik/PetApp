"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser, clearAuthCookie } from "@/lib/auth";

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
    })
    .eq("id", uid);

  return { ok: !error };
}

export async function logout() {
  await clearAuthCookie();
  redirect("/login");
}
