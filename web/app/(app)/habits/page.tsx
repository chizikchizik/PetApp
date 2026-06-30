import Link from "next/link";
import { getHabits } from "@/lib/data";
import { getHabitMonth, calcStreak, monthLabel, prevMonth, nextMonth } from "@/lib/habits";

export const dynamic = "force-dynamic";

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const today = new Date().toISOString().slice(0, 7);
  const todayDate = new Date().toISOString().slice(0, 10);
  const targetMonth = month ?? today;

  const [habits, days] = await Promise.all([
    getHabits(targetMonth),
    getHabitMonth(targetMonth),
  ]);

  const prev = prevMonth(targetMonth);
  const next = nextMonth(targetMonth);
  const isCurrentMonth = targetMonth === today;

  return (
    <>
      {/* ── Шапка ── */}
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        ПРИВЫЧКИ
      </h1>

      {/* ── Навигация по месяцу ── */}
      <div className="mt-5 flex items-center justify-between">
        <Link
          href={`/habits?month=${prev}`}
          className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-3 transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="font-mono text-[13px] tracking-[0.06em] uppercase text-ink-2">
          {monthLabel(targetMonth)}
        </span>
        <Link
          href={isCurrentMonth ? "/habits" : `/habits?month=${next}`}
          className={`flex h-9 w-9 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-3 transition active:scale-95 ${isCurrentMonth ? "pointer-events-none opacity-30" : ""}`}
          aria-disabled={isCurrentMonth}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      {/* ── Матрица (история, ячейки — ссылки на чек-ин) ── */}
      {habits.length === 0 ? (
        <p className="mt-4 font-mono text-[13px] text-ink-3">
          Добавь первую привычку выше.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "max-content" }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-10 border-b border-line bg-surface pb-2.5 pl-3.5 pr-3 pt-2.5 text-left font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3"
                    style={{ minWidth: 110 }}
                  >
                    привычка
                  </th>
                  {days.map((d) => {
                    const [wd, dayNum] = d.label.split(" ");
                    const isToday = d.dateISO === todayDate;
                    return (
                      <th
                        key={d.dateISO}
                        className="border-b border-line px-[3px] pb-2 pt-2 text-center font-mono text-[9px] uppercase leading-none"
                        style={{ width: 26, color: isToday ? "var(--phase)" : "var(--ink-3)" }}
                      >
                        <div>{wd}</div>
                        <div className="mt-0.5 text-[8px] opacity-70">{dayNum}</div>
                      </th>
                    );
                  })}
                  <th className="border-b border-line pb-2.5 pl-3 pr-3.5 pt-2.5 text-center font-mono text-[9px] uppercase text-ink-3" style={{ minWidth: 36 }}>
                    ∑
                  </th>
                </tr>
              </thead>
              <tbody>
                {habits.map((habit, hi) => {
                  const s = calcStreak(habit, days);
                  return (
                    <tr key={habit} className={hi > 0 ? "border-t border-line" : ""}>
                      <td
                        className="sticky left-0 z-10 bg-surface py-2 pl-3.5 pr-3 font-sans text-[12.5px] font-medium text-ink"
                        style={{ minWidth: 110, maxWidth: 130 }}
                      >
                        <span className="block truncate">{habit}</span>
                      </td>
                      {days.map((d) => {
                        const done = d.done.includes(habit);
                        const isToday = d.dateISO === todayDate;
                        const isFuture = d.dateISO > todayDate;
                        return (
                          <td key={d.dateISO} className="px-[3px] py-2 text-center">
                            <Link
                              href={`/checkin?date=${d.dateISO}`}
                              className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border transition active:scale-90"
                              style={{
                                background: done ? "var(--phase)" : "transparent",
                                borderColor: done ? "var(--phase)" : isToday ? "var(--phase)" : "var(--line)",
                                opacity: isFuture ? 0.25 : 1,
                                pointerEvents: isFuture ? "none" : undefined,
                              }}
                              tabIndex={isFuture ? -1 : undefined}
                            >
                              {done && (
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--on-phase)" strokeWidth="3.4" strokeLinecap="round">
                                  <path d="M5 12l5 5L20 7" />
                                </svg>
                              )}
                            </Link>
                          </td>
                        );
                      })}
                      <td className="py-2 pl-3 pr-3.5 text-center font-mono font-semibold text-[13px]" style={{ color: s > 0 ? "var(--phase)" : "var(--ink-4)" }}>
                        {s > 0 ? s : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="font-mono text-[9px] text-ink-4">
          нажми на день → чек-ин за эту дату
        </p>
        <Link
          href={`/habits/bulk?month=${targetMonth}`}
          className="font-mono text-[10px] tracking-[0.06em] text-ink-3 underline underline-offset-2 transition active:opacity-60"
        >
          заполнить / управление →
        </Link>
      </div>
    </>
  );
}
