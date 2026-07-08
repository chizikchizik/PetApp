import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";

// ── "Давление и мигрень" (/insights) ─────────────────────────────────────────
// Источник — Open-Meteo: бесплатный, без ключа. Давление — среднесуточное
// приведённое к уровню моря (pressure_msl_mean, гПа) — то же число, что
// показывают прогнозы погоды, в отличие от станционного surface_pressure,
// которое в высоких городах выглядит "неправильно низким".
//
// Архив ERA5 публикуется с задержкой ~5 дней — последние дни на графике
// просто отсутствуют, это нормально для фичи про историю, не про "сейчас".
const ARCHIVE_LAG_DAYS = 6;

// Заметное суточное падение давления, гПа. Порог для автопоиска: сравниваем
// долю приступов, перед которыми было такое падение, с долей таких дней
// вообще (базовый уровень случайности).
const DROP_HPA = 3;

async function getAppUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function realUid(uid: string | null): string | null {
  if (!uid || uid === "__legacy__") return null;
  return uid;
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export type PressureSettings = { city: string; lat: number; lon: number };

// Читает город отдельным запросом, а НЕ через USER_SELECT в getCurrentUser()
// — чтобы деплой кода до применения миграции 057 не мог сломать вход для
// всех пользователей (getCurrentUser вызывается на каждом запросе; урок
// инцидента с workout_year_goal). Ошибка здесь деградирует в "город не
// указан" → блок просто показывает онбординг.
export async function getPressureSettings(): Promise<PressureSettings | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const uid = realUid(await getAppUserId());
  if (!uid) return null;
  const { data, error } = await db
    .from("app_user")
    .select("pressure_city, pressure_lat, pressure_lon")
    .eq("id", uid)
    .maybeSingle();
  if (error || !data?.pressure_city || data.pressure_lat == null || data.pressure_lon == null) return null;
  return { city: data.pressure_city, lat: Number(data.pressure_lat), lon: Number(data.pressure_lon) };
}

export type PressureDay = { date: string; hpa: number };

async function fetchArchive(
  lat: number,
  lon: number,
  from: string,
  to: string,
): Promise<PressureDay[]> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${from}&end_date=${to}&daily=pressure_msl_mean&timezone=auto`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    const times: string[] = json?.daily?.time ?? [];
    const vals: (number | null)[] = json?.daily?.pressure_msl_mean ?? [];
    const out: PressureDay[] = [];
    for (let i = 0; i < times.length; i++) {
      const v = vals[i];
      if (v != null) out.push({ date: times[i], hpa: v });
    }
    return out;
  } catch {
    return [];
  }
}

// Ленивый кэш: читаем daily_pressure за диапазон; если чего-то не хватает —
// один запрос к архиву за весь диапазон и upsert недостающего. Никакого
// крона — добор происходит при открытии /insights.
export async function getDailyPressure(from: string, to: string): Promise<PressureDay[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = realUid(await getAppUserId());
  if (!uid) return [];
  const settings = await getPressureSettings();
  if (!settings) return [];

  const clampTo = addDaysISO(todayISOMoscow(), -ARCHIVE_LAG_DAYS) < to
    ? addDaysISO(todayISOMoscow(), -ARCHIVE_LAG_DAYS)
    : to;
  if (clampTo < from) return [];

  const expectedRows = Math.round(
    (new Date(clampTo + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86400000,
  ) + 1;

  const { data: cached } = await db
    .from("daily_pressure")
    .select("pressure_date, pressure_hpa")
    .eq("app_user_id", uid)
    .gte("pressure_date", from)
    .lte("pressure_date", clampTo)
    .order("pressure_date", { ascending: true })
    .limit(Math.max(expectedRows + 10, 100));

  const byDate = new Map<string, number>();
  for (const r of (cached ?? []) as { pressure_date: string; pressure_hpa: number }[]) {
    byDate.set(r.pressure_date, Number(r.pressure_hpa));
  }

  // Рефетчим только если кэш ещё НЕ дотягивается до конца диапазона (появились
  // новые дни в архиве). Раньше условие было `byDate.size < expected` — любой
  // пропущенный день в архиве (fetchArchive отбрасывает null) держал размер
  // ниже ожидаемого навсегда, и внешний запрос к Open-Meteo повторялся на
  // каждый рендер. Проверка по самой свежей закэшированной дате устойчива к
  // внутренним пропускам: interior-дыра больше не форсит вечный рефетч.
  const newestCached = byDate.size > 0 ? [...byDate.keys()].sort().at(-1)! : "";
  if (newestCached < clampTo) {
    const fetched = await fetchArchive(settings.lat, settings.lon, from, clampTo);
    const missing = fetched.filter((p) => !byDate.has(p.date));
    for (let i = 0; i < missing.length; i += 500) {
      const chunk = missing.slice(i, i + 500).map((p) => ({
        app_user_id: uid,
        pressure_date: p.date,
        pressure_hpa: p.hpa,
      }));
      await db.from("daily_pressure").upsert(chunk, {
        onConflict: "app_user_id,pressure_date",
        ignoreDuplicates: true,
      });
    }
    for (const p of missing) byDate.set(p.date, p.hpa);
  }

  return [...byDate.entries()]
    .map(([date, hpa]) => ({ date, hpa }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Автопоиск закономерности ─────────────────────────────────────────────────
// Метрика одна и явная (требование Елены: не смешивать гипотезы): суточное
// падение давления НАКАНУНЕ приступа — hpa(d−1) − hpa(d−2), т.е. изменение
// в окне продрома за 24–48ч до начала, а не в день самой боли. Вывод
// показывается только если сигнал заметно выше случайного уровня; иначе
// блок остаётся чисто визуальным сопоставлением.
export type PressureAnalysis =
  | { state: "insufficient"; attacksWithData: number; needed: number }
  | { state: "none"; attacksWithData: number }
  | {
      state: "found";
      attacksWithData: number;
      withDrop: number;
      typicalDropHpa: number;
      attackPct: number;
      baselinePct: number;
      matchedDates: string[];
    };

export function analyzePressure(
  attackDates: string[],
  pressure: PressureDay[],
): PressureAnalysis {
  const NEEDED = 8;      // порог Елены: минимум приступов
  const MIN_SPAN = 60;   // и охват ≥2 месяцев, иначе псевдо-сезонное совпадение

  const hpa = new Map(pressure.map((p) => [p.date, p.hpa]));
  const dropOn = (date: string): number | null => {
    const cur = hpa.get(date);
    const prev = hpa.get(addDaysISO(date, -1));
    if (cur == null || prev == null) return null;
    return cur - prev;
  };

  const attacks = [...new Set(attackDates)].sort();
  const usable: { date: string; drop: number }[] = [];
  for (const d of attacks) {
    const drop = dropOn(addDaysISO(d, -1));
    if (drop != null) usable.push({ date: d, drop });
  }

  const spanDays = usable.length >= 2
    ? Math.round(
        (new Date(usable[usable.length - 1].date + "T12:00:00").getTime() -
          new Date(usable[0].date + "T12:00:00").getTime()) / 86400000,
      )
    : 0;

  if (usable.length < NEEDED || spanDays < MIN_SPAN) {
    return { state: "insufficient", attacksWithData: usable.length, needed: NEEDED };
  }

  const matched = usable.filter((a) => a.drop <= -DROP_HPA);
  const attackPct = matched.length / usable.length;

  let baseDrops = 0;
  let baseDays = 0;
  for (const p of pressure) {
    const drop = dropOn(p.date);
    if (drop == null) continue;
    baseDays++;
    if (drop <= -DROP_HPA) baseDrops++;
  }
  const baselinePct = baseDays > 0 ? baseDrops / baseDays : 0;

  const found =
    attackPct >= 0.4 &&
    attackPct >= 1.5 * Math.max(baselinePct, 0.01);

  if (!found) return { state: "none", attacksWithData: usable.length };

  const drops = matched.map((a) => a.drop).sort((a, b) => a - b);
  const typicalDropHpa = Math.round(drops[Math.floor(drops.length / 2)]);

  return {
    state: "found",
    attacksWithData: usable.length,
    withDrop: matched.length,
    typicalDropHpa,
    attackPct: Math.round(attackPct * 100),
    baselinePct: Math.round(baselinePct * 100),
    matchedDates: matched.map((a) => a.date),
  };
}
