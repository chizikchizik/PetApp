"use server";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Upserts habits_done for each date in `data`, preserving all other daily_log fields.
 * data: { "2026-01-15": ["Читать", "Прогулка"], ... }
 */
export async function saveBulkHabits(
  _month: string,
  data: Record<string, string[]>,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };

  const dates = Object.keys(data);
  if (dates.length === 0) return { ok: true };

  // Fetch existing rows to preserve non-habit fields
  const { data: existing, error: fetchErr } = await db
    .from("daily_log")
    .select("*")
    .in("log_date", dates);

  if (fetchErr) return { ok: false, error: fetchErr.message };

  const existingByDate: Record<string, Record<string, unknown>> = {};
  for (const row of existing ?? []) {
    existingByDate[(row as { log_date: string }).log_date] = row as Record<string, unknown>;
  }

  const upsertRows = dates.map((date) => {
    // Strip `id` so Supabase doesn't null-fill it for rows where the column is absent.
    // onConflict:"log_date" matches existing rows without needing id in the payload.
    const { id: _id, ...base } = (existingByDate[date] ?? {}) as Record<string, unknown>;
    return {
      ...base,
      log_date: date,
      habits_done: data[date],
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upsertErr } = await db
    .from("daily_log")
    .upsert(upsertRows, { onConflict: "log_date" });

  if (upsertErr) return { ok: false, error: upsertErr.message };

  revalidatePath("/habits");
  revalidatePath("/habits/bulk");
  return { ok: true };
}
