"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addCycleStart(dateISO: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const { error } = await db
    .from("cycle_start")
    .upsert({ start_date: dateISO }, { onConflict: "start_date", ignoreDuplicates: true });
  if (error) return { ok: false };
  revalidatePath("/cycle");
  revalidatePath("/dashboard");
  revalidatePath("/checkin");
  return { ok: true };
}

export async function removeCycleStart(dateISO: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const { error } = await db
    .from("cycle_start")
    .delete()
    .eq("start_date", dateISO);
  if (error) return { ok: false };
  revalidatePath("/cycle");
  revalidatePath("/dashboard");
  revalidatePath("/checkin");
  return { ok: true };
}
