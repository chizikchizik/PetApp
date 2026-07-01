"use client";

import { useState, useTransition } from "react";
import { addCycleStart, removeCycleStart } from "./actions";
import { isoLocal } from "@/lib/format";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** JS getDay() → Mon-based index 0–6 (Mon=0, Sun=6) */
function monBasedDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function isPeriodDay(iso: string, periodStarts: string[]): boolean {
  return periodStarts.includes(iso);
}

function isWithinMenstrualWindow(iso: string, periodStarts: string[]): boolean {
  const date = new Date(iso + "T12:00:00");
  for (const start of periodStarts) {
    const startDate = new Date(start + "T12:00:00");
    const diff = Math.round(
      (date.getTime() - startDate.getTime()) / 86_400_000
    );
    if (diff >= 1 && diff <= 4) return true;
  }
  return false;
}

export function CycleCalendar({
  periodStarts: initialStarts,
  month,
}: {
  periodStarts: string[];
  month: string;
}) {
  const [starts, setStarts] = useState<string[]>(initialStarts);
  const [pending, startTransition] = useTransition();
  const [loadingDate, setLoadingDate] = useState<string | null>(null);

  const [year, monthIndex] = month.split("-").map(Number);
  const monthIdx = monthIndex - 1; // 0-based

  const todayISO = isoLocal(new Date());
  const today = new Date(todayISO + "T12:00:00");

  const firstOfMonth = new Date(year, monthIdx, 1);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  // Leading empty cells: Mon=0, so if firstOfMonth is Wednesday (mon-based 2), we need 2 empty cells
  const leadingEmpties = monBasedDay(firstOfMonth);

  function handleDayTap(iso: string) {
    const isFuture = iso > todayISO;
    if (isFuture) return;

    const isStart = starts.includes(iso);
    setLoadingDate(iso);

    // Optimistic update
    if (isStart) {
      setStarts((prev) => prev.filter((s) => s !== iso));
    } else {
      setStarts((prev) => [...prev, iso].sort());
    }

    startTransition(async () => {
      if (isStart) {
        await removeCycleStart(iso);
      } else {
        await addCycleStart(iso);
      }
      setLoadingDate(null);
    });
  }

  const cells: React.ReactNode[] = [];

  // Leading empty cells
  for (let i = 0; i < leadingEmpties; i++) {
    cells.push(<div key={`empty-${i}`} className="h-10 w-10" />);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(year, monthIdx, d);
    const isFuture = iso > todayISO;
    const isToday = iso === todayISO;
    const isStart = isPeriodDay(iso, starts);
    const isMenstrual = !isStart && isWithinMenstrualWindow(iso, starts);
    const isLoading = loadingDate === iso;

    let cellCls =
      "h-10 w-10 flex items-center justify-center rounded-full text-[14px] transition select-none";

    if (isLoading) {
      cellCls += " opacity-50";
    }

    if (isStart) {
      cellCls += " bg-phase text-on-phase font-semibold";
    } else if (isMenstrual) {
      cellCls += " bg-phase-soft text-phase-deep";
    } else if (isToday) {
      cellCls += " border border-phase text-ink";
    } else if (isFuture) {
      cellCls += " text-ink-3 opacity-40 pointer-events-none";
    } else {
      cellCls += " text-ink hover:bg-phase-soft cursor-pointer";
    }

    cells.push(
      <button
        key={iso}
        type="button"
        disabled={isFuture || (pending && loadingDate === iso)}
        onClick={() => handleDayTap(iso)}
        className={cellCls}
        aria-label={`${d} — ${isStart ? "убрать начало цикла" : "отметить начало цикла"}`}
      >
        {d}
      </button>
    );
  }

  return (
    <div className="mt-5">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="h-10 w-10 flex items-center justify-center font-mono text-[9px] uppercase text-ink-3"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells}
      </div>

      {/* Legend / hint */}
      <p className="mt-4 font-sans text-[12px] text-ink-3 leading-relaxed">
        Отметь первый день каждой менструации. Остальные дни цикла приложение рассчитает само.
      </p>
    </div>
  );
}
