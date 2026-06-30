/**
 * Seed daily habit marks — Part 2 (confident daily habits, gap fill).
 *
 * What we know from paper photos:
 *   АД     — ежедневно с марта. Apr 6–Jun 22 уже засеяно → досеваем Mar 1–Apr 5.
 *   Глицин — ежедневно с февраля → Feb 1–Jun 22 (всё новое).
 *
 * Спорт, Бег, Читать и остальные — не сидируем: конкретные дни
 * не читаются надёжно с фото. Отмечай вручную в /checkin.
 *
 * Run: node --env-file=.env.local scripts/seed-v2.mjs
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// date → Set of habits to ensure are present
const toSeed = new Map();

function addRange(habit, start, end) {
  const d = new Date(start + "T12:00:00Z");
  const endDate = new Date(end + "T12:00:00Z");
  while (d <= endDate) {
    const iso = d.toISOString().slice(0, 10);
    if (!toSeed.has(iso)) toSeed.set(iso, new Set());
    toSeed.get(iso).add(habit);
    d.setDate(d.getDate() + 1);
  }
}

// АД: Mar 1–Apr 5 (gap before existing seed which starts Apr 6)
addRange("АД",     "2026-03-01", "2026-04-05");

// Глицин: Feb 1–Jun 22 (entirely new)
addRange("Глицин", "2026-02-01", "2026-06-22");

const dates = [...toSeed.keys()].sort();
console.log(`Seeding ${dates.length} dates (${dates[0]} → ${dates.at(-1)})`);

async function fetchExisting(date) {
  const res = await fetch(
    `${url}/rest/v1/daily_log?log_date=eq.${date}&select=log_date,habits_done`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

async function insertDay(date, habits) {
  const res = await fetch(`${url}/rest/v1/daily_log`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ log_date: date, habits_done: [...habits] }),
  });
  return res.ok;
}

async function updateDay(date, merged) {
  const res = await fetch(`${url}/rest/v1/daily_log?log_date=eq.${date}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ habits_done: merged }),
  });
  return res.ok;
}

let inserted = 0, updated = 0, skipped = 0, errors = 0;

const CHUNK = 20;
for (let i = 0; i < dates.length; i += CHUNK) {
  const chunk = dates.slice(i, i + CHUNK);
  await Promise.all(
    chunk.map(async (date) => {
      const newHabits = [...toSeed.get(date)];
      const existing = await fetchExisting(date);

      if (!existing) {
        const ok = await insertDay(date, newHabits);
        if (ok) { inserted++; process.stdout.write("✓"); }
        else     { errors++;   process.stdout.write("✗"); }
      } else {
        const current = existing.habits_done ?? [];
        const needsUpdate = newHabits.some((h) => !current.includes(h));
        if (!needsUpdate) { skipped++; process.stdout.write("·"); return; }
        const merged = [...new Set([...current, ...newHabits])];
        const ok = await updateDay(date, merged);
        if (ok) { updated++; process.stdout.write("✓"); }
        else    { errors++;  process.stdout.write("✗"); }
      }
    })
  );
}

console.log(`\n\nDone:`);
console.log(`  Inserted: ${inserted} new days`);
console.log(`  Updated:  ${updated} existing days`);
console.log(`  Skipped:  ${skipped} already correct`);
console.log(`  Errors:   ${errors}`);
console.log(`\nSporadic habits (Спорт, Бег, Читать, Прогулка, Без соцсетей)`);
console.log(`→ mark manually in /checkin for past dates.`);
