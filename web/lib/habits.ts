import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isoDaysFromTodayMoscow } from "@/lib/format";

export type HabitDay = {
  dateISO: string;
  label: string;
  done: string[];
};

const RU_WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const RU_MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function labelFor(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return `${RU_WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

async function fetchByDates(dates: string[]): Promise<HabitDay[]> {
  const db = supabaseAdmin();
  if (!db) return dates.map((d) => ({ dateISO: d, label: labelFor(d), done: [] }));
  const { data } = await db
    .from("daily_log")
    .select("log_date, habits_done")
    .in("log_date", dates);
  const byDate: Record<string, string[]> = {};
  for (const r of data ?? []) {
    byDate[(r as { log_date: string; habits_done: string[] }).log_date] =
      (r as { log_date: string; habits_done: string[] }).habits_done ?? [];
  }
  return dates.map((d) => ({ dateISO: d, label: labelFor(d), done: byDate[d] ?? [] }));
}

export async function getHabitDays(days = 14): Promise<HabitDay[]> {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(isoDaysFromTodayMoscow(-i));
  }
  return fetchByDates(dates);
}

/** Возвращает все дни указанного месяца (YYYY-MM) с отметками привычек. */
export async function getHabitMonth(yearMonth: string): Promise<HabitDay[]> {
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${yearMonth}-${String(d).padStart(2, "0")}`);
  }
  return fetchByDates(dates);
}

export function calcStreak(habitName: string, days: HabitDay[]): number {
  return days.filter((d) => d.done.includes(habitName)).length;
}

export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${RU_MONTHS[m - 1]} ${y}`;
}

export function prevMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

export function nextMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
