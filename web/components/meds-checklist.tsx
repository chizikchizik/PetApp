"use client";

import { useState } from "react";

export type Med = {
  id: string;
  name: string;
  note: string;
  when: string;
  time: string;
};

export function MedsChecklist({ meds }: { meds: readonly Med[] }) {
  // Витамины утром обычно уже приняты; АД — вечером. Пока локально (БД подключим позже).
  const [done, setDone] = useState<Record<string, boolean>>({ vitamins: true });

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-sm">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
        Приём сегодня
      </p>
      {meds.map((m, i) => {
        const checked = !!done[m.id];
        return (
          <div
            key={m.id}
            className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <button
              type="button"
              aria-label={`${m.name}: отметить приём`}
              onClick={() => setDone((d) => ({ ...d, [m.id]: !d[m.id] }))}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-[2px] border-[1.5px] transition ${
                checked ? "border-phase bg-phase text-on-phase" : "border-ink-3 text-transparent"
              }`}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </button>
            <div className="flex-1">
              <div className={`text-[15px] ${checked ? "text-ink-3 line-through" : "text-ink"}`}>
                {m.name}
              </div>
              <div className="text-[11px] text-ink-3">
                {m.note} · {m.when} {m.time}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
