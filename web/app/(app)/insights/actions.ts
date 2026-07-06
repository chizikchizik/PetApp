"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

async function getUid(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user || user.id === "__legacy__") return null;
    return user.id;
  } catch {
    return null;
  }
}

// Геокодинг через Open-Meteo (бесплатный, без ключа). Сохраняем то, что
// вернул геокодер (каноническое имя + координаты), а не сырой ввод.
export async function savePressureCity(
  cityInput: string,
): Promise<{ ok: boolean; city?: string; error?: string }> {
  const q = cityInput.trim();
  if (!q) return { ok: false, error: "Введи город" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getUid();
  if (!uid) return { ok: false, error: "Недоступно для этого аккаунта" };

  let result: { name: string; latitude: number; longitude: number; admin1?: string } | undefined;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=ru&format=json`,
      { cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: "Сервис геокодинга недоступен, попробуй позже" };
    const json = await res.json();
    result = json?.results?.[0];
  } catch {
    return { ok: false, error: "Сервис геокодинга недоступен, попробуй позже" };
  }
  if (!result) return { ok: false, error: "Город не найден — проверь написание" };

  const { error } = await db
    .from("app_user")
    .update({
      pressure_city: result.name,
      pressure_lat: result.latitude,
      pressure_lon: result.longitude,
    })
    .eq("id", uid);
  if (error) return { ok: false, error: error.message };

  // Кэш давления привязан к координатам — при смене города он неверен.
  await db.from("daily_pressure").delete().eq("app_user_id", uid);

  revalidatePath("/insights");
  return { ok: true, city: result.name };
}
