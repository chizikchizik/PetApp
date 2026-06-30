// Заливает полную историю мигрени из Migrebot CSV в migraine_event.
// Запуск: cd web && node --env-file=.env.local scripts/seed-migraine.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const dir = "/Users/marinasvec/petapp/startdata/migrebot";
const file = readdirSync(dir).find((f) => f.endsWith(".csv"));
const text = readFileSync(join(dir, file), "utf8");

function parseCSV(t) {
  const rows = [];
  let row = [];
  let f = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n") {
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else if (c !== "\r") f += c;
  }
  if (f.length || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

const rows = parseCSV(text);
const head = rows[0].map((h) => h.trim());
const col = (name) => head.indexOf(name);
const iDate = col("Дата");
const iHead = col("Головная боль");
const iAura = col("Аура");
const iMeds = col("Принятые медикаменты");
const iInt = col("Интенсивность боли");

const byDate = new Map();
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const date = (row[iDate] || "").trim();
  if (!date || (row[iHead] || "").trim() !== "Да") continue;
  const meds = (row[iMeds] || "").trim();
  // «Спрей» в дневнике = назальный суматриптан (Имигран/Сумамигрен) → тоже триптан.
  const triptan = /суматриптан|триптан|релпакс|делмигрен|спрей/i.test(meds);
  const intensity = parseInt(row[iInt], 10);
  const e = {
    event_date: date,
    aura: (row[iAura] || "").trim() === "Да",
    triptan,
    meds: meds || null,
    intensity: Number.isFinite(intensity) ? intensity : null,
  };
  const ex = byDate.get(date);
  if (ex) {
    ex.aura = ex.aura || e.aura;
    ex.triptan = ex.triptan || e.triptan;
    ex.intensity = ex.intensity ?? e.intensity;
  } else byDate.set(date, e);
}

const events = [...byDate.values()];
await db.from("migraine_event").delete().gte("event_date", "1900-01-01");

let inserted = 0;
for (let i = 0; i < events.length; i += 100) {
  const chunk = events.slice(i, i + 100);
  let ok = false;
  let lastErr = "";
  for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
    try {
      const { error } = await db.from("migraine_event").insert(chunk);
      if (!error) ok = true;
      else lastErr = error.message;
    } catch (e) {
      lastErr = String(e);
    }
    if (!ok && attempt < 5) await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  if (!ok) {
    console.log(`ОШИБКА на чанке ${i} (после 5 попыток): ${lastErr}`);
    process.exit(1);
  }
  inserted += chunk.length;
}
console.log(
  `залито ${inserted} дней с мигренью (${events.filter((e) => e.triptan).length} с триптаном), период ${events.at(-1)?.event_date}…${events[0]?.event_date}`,
);
