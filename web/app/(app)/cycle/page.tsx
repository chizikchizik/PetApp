export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPeriodStarts } from "@/lib/data";
import { CycleCalendar } from "./cycle-calendar";

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export default async function CyclePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;

  const todayISO = new Date().toISOString().slice(0, 10);
  const currentMonth = todayISO.slice(0, 7); // YYYY-MM

  // Validate / clamp month param
  const month =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) && monthParam <= currentMonth
      ? monthParam
      : currentMonth;

  // Fetch period starts from DB (with fallback to seed data)
  let periodStartStrings: string[];

  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("cycle_start")
      .select("start_date")
      .order("start_date", { ascending: true });
    if (!error && data && data.length > 0) {
      periodStartStrings = data.map((r: { start_date: string }) => r.start_date);
    } else {
      const dates = await getPeriodStarts();
      periodStartStrings = dates.map((d) => d.toISOString().slice(0, 10));
    }
  } else {
    const dates = await getPeriodStarts();
    periodStartStrings = dates.map((d) => d.toISOString().slice(0, 10));
  }

  const [yearNum, monthNum] = month.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${yearNum}`;

  const prev = prevMonth(month);
  const next = nextMonth(month);
  const canGoNext = next <= currentMonth;

  return (
    <>
      <header>
        <Link
          href="/dashboard"
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
        >
          ← дашборд
        </Link>
        <h1 className="mt-3 font-serif font-bold text-[24px] uppercase">ЦИКЛ</h1>
        <p className="mt-2 font-mono text-[11px] text-ink-2">
          отметь первые дни менструации
        </p>
      </header>

      {/* Month navigation */}
      <div className="mt-5 flex items-center justify-between">
        <Link
          href={`/cycle?month=${prev}`}
          className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-line text-ink-2 hover:border-phase hover:text-phase transition"
          aria-label="Предыдущий месяц"
        >
          <span className="font-mono text-[14px]">←</span>
        </Link>

        <span className="font-sans text-[15px] font-semibold text-ink">
          {monthLabel}
        </span>

        {canGoNext ? (
          <Link
            href={`/cycle?month=${next}`}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-line text-ink-2 hover:border-phase hover:text-phase transition"
            aria-label="Следующий месяц"
          >
            <span className="font-mono text-[14px]">→</span>
          </Link>
        ) : (
          <div className="h-9 w-9" aria-hidden />
        )}
      </div>

      <CycleCalendar periodStarts={periodStartStrings} month={month} />
    </>
  );
}
