import Link from "next/link";
import { getHabits, getAllHabits } from "@/lib/data";
import { getHabitMonth, monthLabel, prevMonth, nextMonth } from "@/lib/habits";
import { todayISOMoscow } from "@/lib/format";
import { BulkForm } from "./bulk-form";
import { HabitManager } from "../habit-manager";

export const dynamic = "force-dynamic";

export default async function BulkHabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const today = todayISOMoscow().slice(0, 7);
  const targetMonth = month && month <= today ? month : today;

  const [habits, allHabits, days] = await Promise.all([
    getHabits(targetMonth),
    getAllHabits(),
    getHabitMonth(targetMonth),
  ]);

  const prev = prevMonth(targetMonth);
  const next = nextMonth(targetMonth);
  const isCurrentMonth = targetMonth === today;

  return (
    <>
      <Link
        href="/habits"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← привычки
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        ЗАПОЛНИТЬ / УПРАВЛЕНИЕ
      </h1>

      <BulkForm
        key={targetMonth}
        habits={habits}
        days={days}
        month={targetMonth}
        prevMonth={prev}
        nextMonth={next}
        monthLabel={monthLabel(targetMonth)}
        isCurrentMonth={isCurrentMonth}
      />

      {/* ── Управление привычками этого месяца ── */}
      <div className="mt-6">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          привычки / управление
        </p>
        <HabitManager
          habits={allHabits}
          currentMonth={today}
          viewedMonth={targetMonth}
        />
      </div>
    </>
  );
}
