"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { saveBulkHabits } from "./actions";

export type DayEntry = {
  dateISO: string;
  label: string;
  done: string[];
};

type Props = {
  habits: string[];
  days: DayEntry[];
  month: string; // YYYY-MM
  prevMonth: string;
  nextMonth: string;
  monthLabel: string;
  isCurrentMonth: boolean;
};

export function BulkForm({
  habits,
  days,
  month,
  prevMonth,
  nextMonth,
  monthLabel,
  isCurrentMonth,
}: Props) {
  // Local state: map of dateISO -> Set of done habits
  const [grid, setGrid] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const d of days) {
      init[d.dateISO] = new Set(d.done);
    }
    return init;
  });

  // Track which dates were modified so we only upsert changed rows
  const dirtyDates = useRef<Set<string>>(new Set());

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const toggle = useCallback((dateISO: string, habit: string) => {
    setGrid((prev) => {
      const next = { ...prev };
      const set = new Set(next[dateISO]);
      if (set.has(habit)) set.delete(habit);
      else set.add(habit);
      next[dateISO] = set;
      dirtyDates.current.add(dateISO);
      return next;
    });
  }, []);

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    const dirty = Array.from(dirtyDates.current);
    if (dirty.length === 0) {
      setStatus("saved");
      return;
    }

    const payload: Record<string, string[]> = {};
    for (const date of dirty) {
      payload[date] = Array.from(grid[date] ?? []);
    }

    setStatus("saving");
    startTransition(async () => {
      const res = await saveBulkHabits(month, payload);
      if (res.ok) {
        dirtyDates.current.clear();
        setStatus("saved");
      } else {
        setErrMsg(res.error ?? "Неизвестная ошибка");
        setStatus("error");
      }
    });
  };

  // Day number labels from dateISO
  const dayNumbers = days.map((d) => parseInt(d.dateISO.slice(8), 10));

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/habits/bulk?month=${prevMonth}`}
          className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-3 transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="font-mono text-[13px] tracking-[0.06em] uppercase text-ink-2">
          {monthLabel}
        </span>
        <Link
          href={isCurrentMonth ? "/habits/bulk" : `/habits/bulk?month=${nextMonth}`}
          className={`flex h-9 w-9 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-3 transition active:scale-95 ${isCurrentMonth ? "pointer-events-none opacity-30" : ""}`}
          aria-disabled={isCurrentMonth}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      {/* Grid */}
      {habits.length === 0 ? (
        <p className="font-mono text-[13px] text-ink-3">Привычки не найдены.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "max-content" }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-10 border-b border-line bg-surface pb-2.5 pl-3.5 pr-3 pt-2.5 text-left font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3"
                    style={{ minWidth: 120 }}
                  >
                    привычка
                  </th>
                  {days.map((d, i) => {
                    const isToday = d.dateISO === today;
                    return (
                      <th
                        key={d.dateISO}
                        className="border-b border-line px-[3px] pb-2.5 pt-2.5 text-center font-mono text-[9px] uppercase"
                        style={{
                          width: 26,
                          color: isToday ? "var(--phase)" : "var(--ink-3)",
                        }}
                      >
                        {dayNumbers[i]}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {habits.map((habit, hi) => (
                  <tr key={habit} className={hi > 0 ? "border-t border-line" : ""}>
                    <td
                      className="sticky left-0 z-10 bg-surface py-2 pl-3.5 pr-3 font-sans text-[12.5px] font-medium text-ink"
                      style={{ minWidth: 120, maxWidth: 160 }}
                    >
                      <span className="block truncate">{habit}</span>
                    </td>
                    {days.map((d) => {
                      const done = grid[d.dateISO]?.has(habit) ?? false;
                      const isToday = d.dateISO === today;
                      // Future dates (beyond today) — not interactive
                      const isFuture = d.dateISO > today;
                      return (
                        <td key={d.dateISO} className="px-[3px] py-2 text-center">
                          <button
                            type="button"
                            disabled={isFuture}
                            onClick={() => !isFuture && toggle(d.dateISO, habit)}
                            className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-[2px] border select-none transition ${
                              isFuture
                                ? "cursor-default opacity-25"
                                : "cursor-pointer"
                            }`}
                            style={{
                              background: done ? "var(--phase)" : "var(--surface)",
                              borderColor: done
                                ? "var(--phase)"
                                : isToday
                                ? "var(--phase)"
                                : "var(--line)",
                            }}
                            aria-label={`${habit} ${d.dateISO} ${done ? "отмечено" : "не отмечено"}`}
                          >
                            {done && (
                              <svg
                                viewBox="0 0 24 24"
                                width="12"
                                height="12"
                                fill="none"
                                stroke="var(--on-phase)"
                                strokeWidth="3.2"
                                strokeLinecap="round"
                              >
                                <path d="M5 12l5 5L20 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-[2px] border border-line bg-surface px-[13px] py-[9px] font-sans text-[13px] transition active:scale-95 disabled:opacity-50"
          style={{
            borderColor: "var(--phase)",
            color: "var(--phase)",
          }}
        >
          {isPending ? "Сохраняю…" : "Сохранить изменения"}
        </button>
        {status === "saved" && !isPending && (
          <span className="font-mono text-[11px] text-ink-3">Сохранено ✓</span>
        )}
        {status === "error" && !isPending && (
          <span className="font-mono text-[11px] text-red-500">{errMsg || "Ошибка"}</span>
        )}
      </div>
    </div>
  );
}
