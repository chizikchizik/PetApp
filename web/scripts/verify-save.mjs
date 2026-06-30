// Проверяет, что чек-ин из приложения сохранился в daily_log за сегодня,
// затем удаляет тестовую строку (чтобы реальный день остался чистым).
// Запуск: cd web && node --env-file=.env.local scripts/verify-save.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const today = "2026-06-26";
const { data, error } = await db
  .from("daily_log")
  .select("log_date, mood, energy, meds_taken, updated_at")
  .eq("log_date", today)
  .maybeSingle();

console.log(
  "ЧТЕНИЕ за",
  today + ":",
  error ? "ОШИБКА " + error.message : data ? JSON.stringify(data) : "СТРОКИ НЕТ",
);

const { error: delErr } = await db.from("daily_log").delete().eq("log_date", today);
console.log("ОЧИСТКА тестовой строки:", delErr ? "ОШИБКА " + delErr.message : "OK");
