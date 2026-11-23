"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// Нет сессии → фильтр, который не совпадёт ни с одной строкой (нулевой UUID
// никому не выдаётся). Раньше было is(null) — поддельный cookie читал и писал
// «ничейные» строки (QA раунд 8, P1-1).
const NO_USER = "00000000-0000-0000-0000-000000000000";

async function getUid(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user || user.id === "__legacy__") return null;
    return user.id;
  } catch { return null; }
}

function byUser(q: any, uid: string | null): any {
  if (!uid) return q.eq("app_user_id", NO_USER);
  return q.eq("app_user_id", uid);
}

export type CalendarEventRow = {
  id: string;
  event_date: string;
  title: string;
  type: "workout" | "event" | "reminder";
  time_start: string | null;
  duration_min: number | null;
  note: string | null;
  status: "planned" | "done" | "skipped";
  moved_to: string | null;
};

export async function getCalendarEvents(from: string, to: string): Promise<CalendarEventRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getUid();
  if (!uid) return [];
  const { data } = await byUser(
    db.from("calendar_event")
      .select("id, event_date, title, type, time_start, duration_min, note, status, moved_to")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date")
      .order("time_start"),
    uid,
  );
  return (data ?? []) as CalendarEventRow[];
}

export type CalendarEventInput = {
  event_date: string;
  title: string;
  type: "workout" | "event" | "reminder";
  time_start?: string;
  duration_min?: number | null;
  note?: string;
};

export async function createCalendarEvent(input: CalendarEventInput): Promise<{ ok: boolean; id?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getUid();
  if (!uid) return { ok: false };
  const { data, error } = await db.from("calendar_event").insert({
    app_user_id: uid,
    event_date: input.event_date,
    title: input.title.trim(),
    type: input.type,
    time_start: input.time_start?.trim() || null,
    duration_min: input.duration_min ?? null,
    note: input.note?.trim() || null,
    status: "planned",
  }).select("id").single();
  if (error) return { ok: false };
  revalidatePath("/training/schedule");
  return { ok: true, id: data?.id };
}

export async function updateCalendarEvent(
  id: string,
  changes: Partial<{
    title: string;
    type: "workout" | "event" | "reminder";
    event_date: string;
    time_start: string | null;
    duration_min: number | null;
    note: string | null;
    status: "planned" | "done" | "skipped";
    moved_to: string | null;
  }>,
): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getUid();
  if (!uid) return { ok: false };
  const { error } = await byUser(
    db.from("calendar_event").update(changes).eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidatePath("/training/schedule");
  return { ok: true };
}

export async function deleteCalendarEvent(id: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getUid();
  if (!uid) return { ok: false };
  const { error } = await byUser(
    db.from("calendar_event").delete().eq("id", id),
    uid,
  );
  if (error) return { ok: false };
  revalidatePath("/training/schedule");
  return { ok: true };
}
