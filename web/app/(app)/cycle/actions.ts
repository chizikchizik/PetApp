"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isLoggableDay } from "@/lib/format";

// Нет сессии → фильтр, который не совпадёт ни с одной строкой (нулевой UUID
// никому не выдаётся). Раньше было is(null) — поддельный cookie читал и писал
// «ничейные» строки (QA раунд 8, P1-1).
const NO_USER = "00000000-0000-0000-0000-000000000000";

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
  if (!isLoggableDay(dateISO)) return { ok: false };
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  if (!uid) return { ok: false };
  const { error } = await db
    .from("cycle_start")
    .upsert(
      { start_date: dateISO, app_user_id: uid },
      { onConflict: "app_user_id,start_date", ignoreDuplicates: true },
    );
  if (error) return { ok: false };
  revalidatePath("/cycle");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeCycleStart(dateISO: string): Promise<{ ok: boolean }> {
  if (!isLoggableDay(dateISO)) return { ok: false };
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  if (!uid) return { ok: false };
  let q = db.from("cycle_start").delete().eq("start_date", dateISO);
  if (uid) q = q.eq("app_user_id", uid);
  else q = q.eq("app_user_id", NO_USER);
  const { error } = await q;
  if (error) return { ok: false };
  revalidatePath("/cycle");
  revalidatePath("/dashboard");
  return { ok: true };
}
