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

export async function addCycleStart(dateISO: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await db
    .from("cycle_start")
    .upsert(
      { start_date: dateISO, app_user_id: uid },
      { onConflict: "app_user_id,start_date", ignoreDuplicates: true },
    );
  if (error) return { ok: false };
  revalidatePath("/cycle");
  revalidatePath("/dashboard");
  revalidatePath("/checkin");
  return { ok: true };
}

export async function removeCycleStart(dateISO: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  let q = db.from("cycle_start").delete().eq("start_date", dateISO);
  if (uid) q = q.eq("app_user_id", uid);
  else q = q.is("app_user_id", null);
  const { error } = await q;
  if (error) return { ok: false };
  revalidatePath("/cycle");
  revalidatePath("/dashboard");
  revalidatePath("/checkin");
  return { ok: true };
}
