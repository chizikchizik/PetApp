/**
 * Seed daily habit marks from handwritten tracker photos (April–June 2026).
 * Source: startdata/checkins/ — photo D9448AA7 (2026 annual tracker).
 *
 * Confident data only:
 *   - АД (амитриптилин): every day April 6 – June 22, 2026
 *   - Витамины: same period
 *
 * Sporadic habits (Спорт, Растяжка, etc.) NOT seeded — individual days
 * not reliably readable from photos.
 *
 * Run: node --env-file=.env.local scripts/seed-habits.mjs
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const HABITS = ["АД", "Витамины"];
const START = "2026-04-06";
const END = "2026-06-22";

function generateDates(start, end) {
  const dates = [];
  const d = new Date(start + "T12:00:00Z");
  const endDate = new Date(end + "T12:00:00Z");
  while (d <= endDate) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

const dates = generateDates(START, END);
console.log(`Seeding ${dates.length} days (${START} → ${END})`);
console.log(`Habits: ${HABITS.join(", ")}\n`);

let inserted = 0;
let updated = 0;
let errors = 0;

async function fetchExisting(date) {
  const res = await fetch(
    `${url}/rest/v1/daily_log?log_date=eq.${date}&select=log_date,habits_done`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] ?? null;
}

async function insertDay(date) {
  const res = await fetch(`${url}/rest/v1/daily_log`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ log_date: date, habits_done: HABITS }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`\nInsert error ${date}:`, err);
    return false;
  }
  return true;
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
  if (!res.ok) {
    const err = await res.text();
    console.error(`\nUpdate error ${date}:`, err);
    return false;
  }
  return true;
}

// Process in chunks to avoid overwhelming the API
const CHUNK = 20;
for (let i = 0; i < dates.length; i += CHUNK) {
  const chunk = dates.slice(i, i + CHUNK);
  await Promise.all(
    chunk.map(async (date) => {
      const existing = await fetchExisting(date);
      if (!existing) {
        const ok = await insertDay(date);
        if (ok) inserted++;
        else errors++;
      } else {
        const current = existing.habits_done ?? [];
        const needsUpdate = HABITS.some((h) => !current.includes(h));
        if (!needsUpdate) {
          process.stdout.write("·");
          return;
        }
        const merged = [...new Set([...current, ...HABITS])];
        const ok = await updateDay(date, merged);
        if (ok) updated++;
        else errors++;
      }
      process.stdout.write("✓");
    })
  );
}

console.log(`\n\nDone:`);
console.log(`  Inserted: ${inserted} new days`);
console.log(`  Updated:  ${updated} existing days (habits merged)`);
console.log(`  Errors:   ${errors}`);
console.log(`\nNote: Спорт, Растяжка and other sporadic habits were NOT seeded`);
console.log(`(individual days not reliably readable from tracker photos).`);
console.log(`Mark those manually in /checkin for specific past dates.`);
