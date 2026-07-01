"use server";
import "server-only";
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

export type WorkoutPayload = {
  type: string;
  duration: number | null;
  fatigue_pct: number | null;
  note: string;
};

export async function saveWorkout(dateISO: string, payload: WorkoutPayload): Promise<{ ok: boolean; id?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();

  const { data, error } = await db.from("workout_log").insert({
    workout_date: dateISO,
    type: payload.type,
    duration_min: payload.duration,
    fatigue_pct: payload.fatigue_pct,
    note: payload.note || null,
    app_user_id: uid,
  }).select("id");
  if (error) return { ok: false };

  // Auto-mark «Спорт» (and «Бег» for run workouts) in habits_done for this day
  const habitsToAdd = ["Спорт"];
  if (/бег/i.test(payload.type)) habitsToAdd.push("Бег");

  const { data: existingLog } = await byUser(
    db.from("daily_log").select("habits_done").eq("log_date", dateISO),
    uid,
  ).maybeSingle();

  const current: string[] = existingLog?.habits_done ?? [];
  const merged = [...new Set([...current, ...habitsToAdd])];

  if (existingLog) {
    await byUser(
      db.from("daily_log")
        .update({ habits_done: merged, updated_at: new Date().toISOString() })
        .eq("log_date", dateISO),
      uid,
    );
  } else {
    await db.from("daily_log").insert({
      log_date: dateISO,
      habits_done: merged,
      updated_at: new Date().toISOString(),
      app_user_id: uid,
    });
  }

  revalidatePath("/training");
  revalidatePath("/checkin");
  return { ok: true, id: data?.[0]?.id };
}

export type ExerciseInput = {
  exercise_name: string;
  exercise_slug?: string | null;
  order_index: number;
  actual_sets?: number | null;
  actual_reps?: string | null;
  actual_weight?: number | null;
  target_sets?: number | null;
  target_reps?: string | null;
  target_weight?: number | null;
  rpe?: number | null;
  note?: string | null;
};

export async function saveExercises(
  workoutId: string,
  exercises: ExerciseInput[],
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();

  // workout_exercise has no app_user_id column — verify ownership via workout_log first.
  const { data: owned } = await byUser(
    db.from("workout_log").select("id").eq("id", workoutId),
    uid,
  ).maybeSingle();
  if (!owned) return { ok: false, error: "Тренировка не найдена" };

  await db.from("workout_exercise").delete().eq("workout_id", workoutId);

  if (exercises.length === 0) {
    revalidatePath("/training");
    return { ok: true };
  }

  const rows = exercises.map((e) => ({ ...e, workout_id: workoutId }));
  const { error } = await db.from("workout_exercise").insert(rows);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/training");
  return { ok: true };
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
  const uid = await getAppUserId();

  // Verify ownership before touching workout_exercise (no app_user_id column there).
  const { data: owned } = await byUser(
    db.from("workout_log").select("id").eq("id", id),
    uid,
  ).maybeSingle();
  if (!owned) return { ok: false };

  await db.from("workout_exercise").delete().eq("workout_id", id);
  const { error } = await byUser(
    db.from("workout_log").delete().eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidatePath("/training");
  return { ok: true };
}

export async function getRecentWorkouts(): Promise<WorkoutRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data } = await byUser(
    db.from("workout_log")
      .select("id, workout_date, type, duration_min, fatigue_pct, note")
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    uid,
  );
  return (data ?? []) as WorkoutRow[];
}

export async function updateWorkout(
  id: string,
  payload: { type: string; workout_date: string; duration: number | null; fatigue_pct: number | null; note: string },
): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("workout_log").update({
      type: payload.type,
      workout_date: payload.workout_date,
      duration_min: payload.duration,
      fatigue_pct: payload.fatigue_pct,
      note: payload.note || null,
    }).eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidatePath("/training");
  return { ok: true };
}

export async function addSportType(name: string): Promise<{ ok: boolean }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false };
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { data: existing } = await byUser(
    db.from("sport_type").select("id").ilike("name", trimmed).limit(1),
    uid,
  );
  if (existing && existing.length > 0) return { ok: true };
  const { data: maxSort } = await byUser(
    db.from("sport_type").select("sort").order("sort", { ascending: false }).limit(1),
    uid,
  );
  const nextSort = (maxSort?.[0]?.sort ?? 0) + 1;
  await byUser(
    db.from("sport_type").insert({ name: trimmed, sort: nextSort, app_user_id: uid }),
    uid,
  );
  revalidatePath("/training");
  return { ok: true };
}

export async function bulkDeleteWorkouts(ids: string[]): Promise<{ ok: boolean }> {
  if (!ids.length) return { ok: true };
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();

  // Only delete workout_exercise rows for workouts the user actually owns.
  const { data: owned } = await byUser(
    db.from("workout_log").select("id").in("id", ids),
    uid,
  );
  const ownedIds = (owned ?? []).map((r: { id: string }) => r.id);
  if (ownedIds.length === 0) return { ok: true };

  await db.from("workout_exercise").delete().in("workout_id", ownedIds);
  const { error } = await byUser(
    db.from("workout_log").delete().in("id", ownedIds),
    uid,
  );
  if (error) return { ok: false };
  revalidatePath("/training");
  return { ok: true };
}
