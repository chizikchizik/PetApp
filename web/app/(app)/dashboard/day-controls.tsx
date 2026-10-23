"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCycleStart, removeCycleStart } from "../cycle/actions";

function shift(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const navBtn =
  "grid h-11 w-11 shrink-0 place-items-center rounded-[3px] border border-line bg-surface font-mono text-[16px] text-ink-2 transition active:bg-surface-2";

// Листание дней для дозаполнения прошлых дат. Будущее недоступно.
export function DayNav({ dayKey, todayISO }: { dayKey: string; todayISO: string }) {
  const router = useRouter();
  const isToday = dayKey === todayISO;
  const href = (iso: string) => (iso === todayISO ? "/dashboard" : `/dashboard?date=${iso}`);
  return (
    <div className="mt-3 flex items-center gap-2">
      <Link href={href(shift(dayKey, -1))} aria-label="Предыдущий день" className={navBtn}>‹</Link>
      <label className="relative flex min-h-[44px] flex-1 items-center justify-center rounded-[3px] border border-line bg-surface px-3">
        <span className="font-mono text-[12px] text-ink-2">{isToday ? "выбрать другой день" : "другой день"}</span>
        <input
          id="day-picker"
          type="date"
          value={dayKey}
          min="2018-01-01"
          max={todayISO}
          aria-label="Выбрать день"
          onChange={(e) => { if (e.target.value) router.push(href(e.target.value)); }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      {isToday ? (
        <span aria-hidden className={`${navBtn} opacity-30`}>›</span>
      ) : (
        <Link href={href(shift(dayKey, 1))} aria-label="Следующий день" className={navBtn}>›</Link>
      )}
      {!isToday && (
        <Link href="/dashboard" className="flex min-h-[44px] shrink-0 items-center rounded-[3px] bg-phase px-3 font-mono text-[12px] font-semibold text-on-phase">
          сегодня
        </Link>
      )}
    </div>
  );
}

// Отметка первого дня месячных. Тап ещё раз снимает отметку — так же,
// как в календаре цикла.
export function PeriodStartButton({ dayKey, isStart }: { dayKey: string; isStart: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(isStart);
  const [pending, startT] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startT(async () => {
      const res = next ? await addCycleStart(dayKey) : await removeCycleStart(dayKey);
      if (!res.ok) setOn(!next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      disabled={pending}
      className={`min-h-[36px] shrink-0 rounded-[3px] border px-2.5 font-mono text-[11px] transition disabled:opacity-60 ${
        on ? "border-phase bg-phase text-on-phase" : "border-line-2 text-ink-2"
      }`}
    >
      {on ? "день 1 ✓" : "месячные начались"}
    </button>
  );
}
