"use client";

import type { Med, MedIntakeDay } from "@/lib/data";

const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildDayRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

// Split days into weeks (Mon-Sun rows)
function toWeeks(days: string[]): string[][] {
  if (days.length === 0) return [];
  const firstDow = (new Date(days[0] + "T12:00:00").getDay() + 6) % 7; // Mon=0
  const padded = Array(firstDow).fill(null).concat(days) as (string | null)[];
  const weeks: string[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7).map((d) => d ?? "") as string[]);
  }
  return weeks;
}

function MonthLabels({ days }: { days: string[] }) {
  // Build month label positions (week index where month first appears)
  const weeks = toWeeks(days);
  const labels: { label: string; weekIdx: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const first = week.find((d) => d);
    if (!first) return;
    const m = parseInt(first.slice(5, 7)) - 1;
    if (m !== lastMonth) {
      labels.push({ label: MONTHS_SHORT[m], weekIdx: wi });
      lastMonth = m;
    }
  });

  return (
    <div className="relative mb-1 ml-0" style={{ display: "grid", gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
      {weeks.map((_, wi) => {
        const lbl = labels.find((l) => l.weekIdx === wi);
        return (
          <div key={wi} className="font-mono text-[8px] text-ink-4 text-center">
            {lbl?.label ?? ""}
          </div>
        );
      })}
    </div>
  );
}

function MedRow({
  med,
  days,
  intakeSet,
  migraineSet,
}: {
  med: Med;
  days: string[];
  intakeSet: Set<string>;
  migraineSet: Set<string>;
}) {
  const weeks = toWeeks(days);

  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-sans text-[14px] font-semibold text-ink">{med.name}</span>
            {med.isAsNeeded && (
              <span className="rounded-[2px] bg-warn/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-warn">по мигрени</span>
            )}
          </div>
          {med.note && <p className="font-mono text-[10px] text-ink-3">{med.note}</p>}
          {!med.isAsNeeded && med.when && (
            <p className="font-mono text-[10px] text-ink-3">{med.when}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-[18px] font-bold text-ink leading-none">
            {intakeSet.size}
          </span>
          <span className="block font-mono text-[8px] text-ink-4">дней</span>
        </div>
      </div>

      {/* Month labels */}
      <MonthLabels days={days} />

      {/* Heatmap grid */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: "2px" }}>
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return <div key={`${wi}-${di}`} className="aspect-square" />;
            const taken   = intakeSet.has(day);
            const migrain = migraineSet.has(day);
            const isAsNeededMig = med.isAsNeeded && migrain;

            let bg = "var(--surface-3)";
            let title = day;
            if (taken) {
              bg = med.isAsNeeded ? "var(--warn, #e8a23a)" : "var(--phase)";
              title = `${day} — принято`;
            } else if (isAsNeededMig) {
              // Migraine day but no triptan logged — could be Migrebot data
              bg = "rgba(232,162,58,0.35)";
              title = `${day} — мигрень (без отметки)`;
            }

            return (
              <div
                key={`${wi}-${di}`}
                className="aspect-square rounded-[2px] transition"
                style={{ background: bg }}
                title={title}
              />
            );
          })
        )}
      </div>

      {/* Row legend if as-needed */}
      {med.isAsNeeded && (
        <div className="mt-2 flex flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: "var(--warn, #e8a23a)" }} />
            <span className="font-mono text-[9px] text-ink-4">принято</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: "rgba(232,162,58,0.35)" }} />
            <span className="font-mono text-[9px] text-ink-4">мигрень без отметки</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MedCalendar({
  meds,
  intakeDays,
  fromISO,
  todayISO,
}: {
  meds: Med[];
  intakeDays: MedIntakeDay[];
  fromISO: string;
  todayISO: string;
}) {
  const days = buildDayRange(fromISO, todayISO);

  // Build per-med intake sets and migraine set
  const migraineSet = new Set(intakeDays.filter((d) => d.migraine).map((d) => d.date));

  const medIntakeSets = new Map<string, Set<string>>();
  for (const med of meds) {
    medIntakeSets.set(med.id, new Set());
  }
  for (const day of intakeDays) {
    for (const medId of day.medIds) {
      const set = medIntakeSets.get(medId);
      if (set) set.add(day.date);
    }
  }

  const regularMeds  = meds.filter((m) => !m.isAsNeeded);
  const asNeededMeds = meds.filter((m) => m.isAsNeeded);

  if (meds.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface p-5 text-center">
        <p className="font-mono text-[12px] text-ink-3">Препаратов не добавлено</p>
        <p className="mt-1 font-mono text-[11px] text-ink-4">Добавь через экран Чек-ин</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {regularMeds.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">Регулярные</p>
          <div className="space-y-3">
            {regularMeds.map((med) => (
              <MedRow
                key={med.id}
                med={med}
                days={days}
                intakeSet={medIntakeSets.get(med.id) ?? new Set()}
                migraineSet={migraineSet}
              />
            ))}
          </div>
        </div>
      )}

      {asNeededMeds.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">По факту мигрени</p>
          <div className="space-y-3">
            {asNeededMeds.map((med) => (
              <MedRow
                key={med.id}
                med={med}
                days={days}
                intakeSet={medIntakeSets.get(med.id) ?? new Set()}
                migraineSet={migraineSet}
              />
            ))}
          </div>
        </div>
      )}

      {/* Global legend */}
      <div className="flex flex-wrap gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[1px]" style={{ background: "var(--phase)" }} />
          <span className="font-mono text-[10px] text-ink-3">принято</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[1px]" style={{ background: "var(--surface-3)" }} />
          <span className="font-mono text-[10px] text-ink-3">нет данных</span>
        </div>
      </div>
    </div>
  );
}
