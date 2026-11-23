"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWorkout } from "./actions";
import { updateCalendarEvent, type CalendarEventRow } from "./schedule/actions";

// Запланированные на сегодня тренировки: одно касание — тренировка записана
// в журнал, событие в расписании отмечено как выполненное.
export function PlannedToday({ events, dayKey }: { events: CalendarEventRow[]; dayKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(ev: CalendarEventRow) {
    setBusy(ev.id);
    setError(null);
    const res = await saveWorkout(dayKey, { type: ev.title, duration: ev.duration_min, fatigue_pct: null, note: "" });
    const upd = res.ok ? await updateCalendarEvent(ev.id, { status: "done" }) : res;
    setBusy(null);
    if (res.ok && upd.ok) router.refresh();
    else setError("Не сохранилось. Проверь интернет и попробуй ещё раз.");
  }

  if (events.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {events.map((ev) => (
        <button
          key={ev.id}
          type="button"
          onClick={() => mark(ev)}
          disabled={busy === ev.id}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-card border border-dashed border-phase bg-phase-soft px-4 py-2.5 text-left disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[11px] text-ink-2">
              сегодня по плану{ev.time_start ? ` · ${ev.time_start.slice(0, 5)}` : ""}{ev.duration_min ? ` · ${ev.duration_min} мин` : ""}
            </span>
            <span className="block font-sans text-[15px] font-semibold text-ink">{ev.title}</span>
          </span>
          <span className="shrink-0 font-mono text-[12px] font-semibold text-phase-deep">{busy === ev.id ? "…" : "была ✓"}</span>
        </button>
      ))}
      {error && <p className="font-sans text-[12px] text-warn">{error}</p>}
    </div>
  );
}
