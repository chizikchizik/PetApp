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

function revalidateAll() {
  revalidatePath("/habits");
  revalidatePath("/checkin");
}

export async function createHabit(
  name: string,
  startedMonth: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Введи название" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  const { error } = await db
    .from("habit")
    .insert({ name: trimmed, active: true, sort: 99, started_month: startedMonth, app_user_id: uid });
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function stopHabit(
  id: number,
  endedMonth: string,
): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("habit").update({ ended_month: endedMonth }).eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidateAll();
  return { ok: true };
}

export async function resumeHabit(
  id: number,
  startedMonth: string,
): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("habit").update({ active: true, ended_month: null, started_month: startedMonth }).eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidateAll();
  return { ok: true };
}

export async function archiveHabit(id: number): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("habit").update({ active: false }).eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidateAll();
  return { ok: true };
}

export async function moveStartToMonth(id: number, month: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("habit").update({ started_month: month }).eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidateAll();
  return { ok: true };
}

export async function deleteHabit(id: number): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("habit").delete().eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidateAll();
  return { ok: true };
}

export async function removeFromMonth(id: number, viewedMonth: string): Promise<{ ok: boolean }> {
  const [y, m] = viewedMonth.split("-").map(Number);
  const prevM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();

  const { data } = await byUser(
    db.from("habit").select("started_month").eq("id", id),
    uid,
  ).maybeSingle();
  const started = (data as { started_month: string | null } | null)?.started_month;

  if (started && prevM < started) {
    const { error } = await byUser(
      db.from("habit").update({ active: false }).eq("id", id),
      uid,
    );
    if (error) return { ok: false };
  } else {
    const { error } = await byUser(
      db.from("habit").update({ ended_month: prevM }).eq("id", id),
      uid,
    );
    if (error) return { ok: false };
  }
  revalidateAll();
  return { ok: true };
}
