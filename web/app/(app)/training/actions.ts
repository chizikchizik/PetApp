"use server";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type WorkoutPayload = {
  type: string;
  duration: number | null;
  fatigue_pct: number | null;
  note: string;
};

export async function saveWorkout(dateISO: string, payload: WorkoutPayload): Promise<{ ok: boolean; id?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const { data, error } = await db.from("workout_log").insert({
    workout_date: dateISO,
    type: payload.type,
    duration_min: payload.duration,
    fatigue_pct: payload.fatigue_pct,
    note: payload.note || null,
  }).select("id");
  if (error) return { ok: false };

  // Auto-mark «Спорт» (and «Бег» for run workouts) in habits_done for this day
  const habitsToAdd = ["Спорт"];
  if (/бег/i.test(payload.type)) habitsToAdd.push("Бег");
  const { data: existingLog } = await db
    .from("daily_log")
    .select("habits_done")
    .eq("log_date", dateISO)
    .maybeSingle();
  const current: string[] = existingLog?.habits_done ?? [];
  const merged = [...new Set([...current, ...habitsToAdd])];
  if (existingLog) {
    await db.from("daily_log")
      .update({ habits_done: merged, updated_at: new Date().toISOString() })
      .eq("log_date", dateISO);
  } else {
    await db.from("daily_log")
      .insert({ log_date: dateISO, habits_done: merged, updated_at: new Date().toISOString() });
  }

  revalidatePath("/training");
  revalidatePath("/checkin");
  return { ok: true, id: data?.[0]?.id };
}

export type ExerciseInput = {
  exercise_name: string
  exercise_slug?: string | null
  order_index: number
  actual_sets?: number | null
  actual_reps?: string | null
  actual_weight?: number | null
  target_sets?: number | null
  target_reps?: string | null
  target_weight?: number | null
  rpe?: number | null
  note?: string | null
}

export async function saveExercises(
  workoutId: string,
  exercises: ExerciseInput[]
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin()
  if (!db) return { ok: false, error: "БД недоступна" }

  // Delete existing exercises for this workout
  await db.from("workout_exercise").delete().eq("workout_id", workoutId)

  if (exercises.length === 0) {
    revalidatePath("/training")
    return { ok: true }
  }

  const rows = exercises.map((e) => ({ ...e, workout_id: workoutId }))
  const { error } = await db.from("workout_exercise").insert(rows)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/training")
  return { ok: true }
}

export type WorkoutRow = {
  id: string;
  workout_date: string;
  type: string;
  duration_min: number | null;
  fatigue_pct: number | null;
  note: string | null;
};

export async function deleteWorkout(id: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  await db.from("workout_exercise").delete().eq("workout_id", id);
  const { error } = await db.from("workout_log").delete().eq("id", id);
  if (error) return { ok: false };
  revalidatePath("/training");
  return { ok: true };
}

export async function getRecentWorkouts(): Promise<WorkoutRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("workout_log")
    .select("id, workout_date, type, duration_min, fatigue_pct, note")
    .order("workout_date", { ascending: false })
    .limit(10);
  return (data ?? []) as WorkoutRow[];
}
