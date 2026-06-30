// Прямая проверка Supabase: схема применена, сид загружен, service-ключ читает/пишет.
// Запуск: cd web && node --env-file=.env.local scripts/db-check.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Нет переменных окружения (.env.local)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "cycle_start",
  "weight_entry",
  "migraine_event",
  "medication",
  "habit",
  "daily_log",
];
console.log("=== количество строк ===");
for (const t of tables) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: ${error ? "ОШИБКА " + error.message : count + " строк"}`);
}

console.log("=== write/read/delete (дата 2000-01-01, удаляется) ===");
const d = "2000-01-01";
const { error: upErr } = await db
  .from("daily_log")
  .upsert({ log_date: d, mood: 3, note: "verify" }, { onConflict: "log_date" });
const { data: back, error: selErr } = await db
  .from("daily_log")
  .select("log_date, mood, note")
  .eq("log_date", d)
  .maybeSingle();
await db.from("daily_log").delete().eq("log_date", d);
console.log(
  upErr
    ? "WRITE ОШИБКА: " + upErr.message
    : selErr
      ? "READ ОШИБКА: " + selErr.message
      : "OK · прочитано обратно: " + JSON.stringify(back),
);
