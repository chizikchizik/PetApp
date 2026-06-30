import { createClient } from "@supabase/supabase-js";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const months = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"];
for (const ym of months) {
  const [y, m] = ym.split("-").map(Number);
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const { count: trip } = await db.from("migraine_event").select("*", { count: "exact", head: true }).eq("triptan", true).gte("event_date", `${ym}-01`).lt("event_date", end);
  const { count: tot } = await db.from("migraine_event").select("*", { count: "exact", head: true }).gte("event_date", `${ym}-01`).lt("event_date", end);
  console.log(`${ym}: триптан ${trip}, всего ${tot}`);
}
