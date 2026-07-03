import Link from "next/link";
import { getHabits, getMeds, getWorkoutHistory, type Med } from "@/lib/data";
import { getHabitMonth, monthLabel, prevMonth, nextMonth, type HabitDay } from "@/lib/habits";
import { SPORT_HABIT_NAMES } from "@/lib/habits-shared";
import { todayISOMoscow } from "@/lib/format";

export const dynamic = "force-dynamic";

type Row = {
  key: string;
  label: string;
  sublabel?: string;
  active: (day: HabitDay) => boolean;
};

function Matrix({ rows, days, todayDate }: { rows: Row[]; days: HabitDay[]; todayDate: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 border-b border-line bg-surface pb-2.5 pl-3.5 pr-3 pt-2.5 text-left font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3"
                style={{ minWidth: 110 }}
              >
                &nbsp;
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
            {rows.map((row, ri) => {
              const s = days.filter((d) => row.active(d)).length;
              return (
                <tr key={row.key} className={ri > 0 ? "border-t border-line" : ""}>
                  <td
                    className="sticky left-0 z-10 bg-surface py-2 pl-3.5 pr-3 font-sans text-[12.5px] font-medium text-ink"
                    style={{ minWidth: 110, maxWidth: 130 }}
                  >
                    <span className="block truncate">{row.label}</span>
                    {row.sublabel && (
                      <span className="block truncate font-mono text-[8px] font-normal uppercase tracking-[0.06em] text-ink-3">
                        {row.sublabel}
                      </span>
                    )}
                  </td>
                  {days.map((d) => {
                    const done = row.active(d);
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
  );
}

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const todayDate = todayISOMoscow();
  const today = todayDate.slice(0, 7);
  const targetMonth = month ?? today;

  const [habits, days, meds, workoutHistory] = await Promise.all([
    getHabits(targetMonth),
    getHabitMonth(targetMonth),
    getMeds(),
    getWorkoutHistory(`${targetMonth}-01`),
  ]);

  const prev = prevMonth(targetMonth);
  const next = nextMonth(targetMonth);
  const isCurrentMonth = targetMonth === today;

  // ── Разбивка на 3 подблока ──────────────────────────────────────────────
  const medHabitKeys = new Set(meds.map((m: Med) => m.habit_key));

  const pureHabitRows: Row[] = habits
    .filter((h) => !medHabitKeys.has(h) && !SPORT_HABIT_NAMES.has(h))
    .map((h) => ({ key: h, label: h, active: (d) => d.done.includes(h) }));

  const medRows: Row[] = meds.map((med) => ({
    key: med.id,
    label: med.name,
    sublabel: med.isAsNeeded ? "для купирования" : "по назначению",
    active: (d) => d.done.includes(med.habit_key),
  }));

  // Конкретный вид спорта — из workout_log за этот месяц (ограничиваем месяцем,
  // т.к. getWorkoutHistory возвращает всё "с этой даты и позже").
  const monthWorkouts = workoutHistory.filter((w) => w.date.slice(0, 7) === targetMonth);
  const sportTypesByDate = new Map<string, Set<string>>();
  for (const w of monthWorkouts) {
    if (!sportTypesByDate.has(w.date)) sportTypesByDate.set(w.date, new Set());
    sportTypesByDate.get(w.date)!.add(w.type);
  }
  const sportTypeNames = [...new Set(monthWorkouts.map((w) => w.type))].sort();
  const sportRows: Row[] = sportTypeNames.map((type) => ({
    key: `sport:${type}`,
    label: type,
    active: (d) => sportTypesByDate.get(d.dateISO)?.has(type) ?? false,
  }));
  // Фолбэк для старых записей "Спорт"/"Бег" без привязки к конкретной
  // тренировке (до того, как появилось логирование по видам).
  const genericSportRow: Row = {
    key: "sport:generic",
    label: "Спорт (без уточнения)",
    active: (d) => {
      if (!d.done.some((h) => SPORT_HABIT_NAMES.has(h))) return false;
      // Не дублировать день, если он уже учтён в одном из типовых рядов выше
      return !sportTypesByDate.has(d.dateISO);
    },
  };
  const hasGenericSportDay = days.some((d) => genericSportRow.active(d));
  if (hasGenericSportDay) sportRows.push(genericSportRow);

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

      {habits.length === 0 && meds.length === 0 && sportRows.length === 0 ? (
        <p className="mt-4 font-mono text-[13px] text-ink-3">
          Добавь первую привычку или препарат ниже.
        </p>
      ) : (
        <>
          <p className="mt-5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">привычки</p>
          {pureHabitRows.length > 0 ? (
            <Matrix rows={pureHabitRows} days={days} todayDate={todayDate} />
          ) : (
            <p className="mt-2 font-mono text-[11px] text-ink-4">Нет привычек — добавь на странице управления</p>
          )}

          <p className="mt-5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">препараты</p>
          {medRows.length > 0 ? (
            <Matrix rows={medRows} days={days} todayDate={todayDate} />
          ) : (
            <p className="mt-2 font-mono text-[11px] text-ink-4">Нет препаратов — добавь на чек-ине или странице управления</p>
          )}

          <p className="mt-5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">спорт</p>
          {sportRows.length > 0 ? (
            <Matrix rows={sportRows} days={days} todayDate={todayDate} />
          ) : (
            <p className="mt-2 font-mono text-[11px] text-ink-4">В этом месяце тренировок не отмечено</p>
          )}
        </>
      )}

      <div className="mt-4 flex items-center justify-between">
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
