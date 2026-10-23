"use server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";

async function getUid(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.id === "__legacy__") throw new Error("Not authenticated");
  return user.id;
}

export async function saveCycle(lastPeriodDate: string, cycleLength: number) {
  const uid = await getUid();
  const db = supabaseAdmin();
  if (!db) throw new Error("DB unavailable");
  // Insert the most recent period start so the cycle engine has data
  await db.from("cycle_start").upsert(
    { app_user_id: uid, start_date: lastPeriodDate },
    { onConflict: "app_user_id,start_date" }
  );
  // Store the self-reported average length as a fallback for getCurrentCycle()
  // until 2+ real cycle_start entries let it compute a real average.
  await db.from("app_user").update({ avg_cycle_length: cycleLength }).eq("id", uid);
}

export async function saveWeight(currentKg: number | null, goalKg: number | null) {
  const uid = await getUid();
  const db = supabaseAdmin();
  if (!db) throw new Error("DB unavailable");
  await db.from("app_user").update({ weight_goal_kg: goalKg, weight_start_kg: currentKg }).eq("id", uid);
  if (currentKg) {
    const today = todayISOMoscow();
    await db.from("weight_entry").upsert(
      { app_user_id: uid, entry_date: today, actual_kg: currentKg },
      { onConflict: "app_user_id,entry_date" }
    );
  }
}

export async function completeOnboarding() {
  const uid = await getUid();
  const db = supabaseAdmin();
  if (!db) throw new Error("DB unavailable");
  await db.from("app_user").update({ onboarding_done: true }).eq("id", uid);
}

// Шаг «Что отслеживаешь» (миграция 060). Хотя бы один раздел обязателен.
export async function saveModules(tracks: { migraine: boolean; training: boolean; weight: boolean }) {
  const uid = await getUid();
  const db = supabaseAdmin();
  if (!db) throw new Error("DB unavailable");
  const t = { migraine: tracks.migraine === true, training: tracks.training === true, weight: tracks.weight === true };
  if (!t.migraine && !t.training && !t.weight) throw new Error("Выбери хотя бы один раздел");
  const { error } = await db
    .from("app_user")
    .update({ track_migraine: t.migraine, track_training: t.training, track_weight: t.weight })
    .eq("id", uid);
  if (error) throw new Error(error.message);
}
