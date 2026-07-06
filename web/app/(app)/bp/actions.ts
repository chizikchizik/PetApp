"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { BpSlot } from "@/lib/data";

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

// Границы — только защита от опечаток, не медицинская валидация.
const SYS_MIN = 60, SYS_MAX = 260, DIA_MIN = 30, DIA_MAX = 160, PULSE_MIN = 30, PULSE_MAX = 220;

export async function saveBpReading(
  dateISO: string,
  slot: BpSlot,
  systolic: number,
  diastolic: number,
  pulse: number | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { ok: false, error: "Неверная дата" };
  if (slot !== "morning" && slot !== "evening") return { ok: false, error: "Неверный слот" };
  if (!Number.isFinite(systolic) || systolic < SYS_MIN || systolic > SYS_MAX)
    return { ok: false, error: `Верхнее: ${SYS_MIN}–${SYS_MAX}` };
  if (!Number.isFinite(diastolic) || diastolic < DIA_MIN || diastolic > DIA_MAX)
    return { ok: false, error: `Нижнее: ${DIA_MIN}–${DIA_MAX}` };
  if (diastolic >= systolic)
    return { ok: false, error: "Верхнее (систолическое) должно быть больше нижнего — проверь, не перепутаны ли поля" };
  if (pulse != null && (!Number.isFinite(pulse) || pulse < PULSE_MIN || pulse > PULSE_MAX))
    return { ok: false, error: `Пульс: ${PULSE_MIN}–${PULSE_MAX}` };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();

  const { error } = await db.from("bp_reading").upsert(
    {
      app_user_id: uid,
      reading_date: dateISO,
      slot,
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      pulse: pulse != null ? Math.round(pulse) : null,
    },
    { onConflict: "app_user_id,reading_date,slot" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bp");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteBpReading(
  dateISO: string,
  slot: BpSlot,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  const { error } = await byUser(
    db.from("bp_reading").delete().eq("reading_date", dateISO).eq("slot", slot),
    uid,
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bp");
  revalidatePath("/dashboard");
  return { ok: true };
}
