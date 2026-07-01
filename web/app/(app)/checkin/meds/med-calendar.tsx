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

function toWeeks(days: string[]): string[][] {
  if (days.length === 0) return [];
  const firstDow = (new Date(days[0] + "T12:00:00").getDay() + 6) % 7;
  const padded = Array(firstDow).fill(null).concat(days) as (string | null)[];
  const weeks: string[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7).map((d) => d ?? "") as string[]);
  }
  return weeks;
}

function MonthLabels({ days }: { days: string[] }) {
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
    <div className="relative mb-1" style={{ display: "grid", gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
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

// ── Medication keywords to detect in meds text ──────────────────────────────
const MED_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /суматриптан|имигран/i,               label: "Суматриптан" },
  { pattern: /золмитриптан|зомиг/i,                label: "Золмитриптан" },
  { pattern: /элетриптан|релпакс/i,                label: "Элетриптан" },
  { pattern: /ризатриптан|максальт/i,              label: "Ризатриптан" },
  { pattern: /наратриптан|нарамиг/i,               label: "Наратриптан" },
  { pattern: /спрей|назальн/i,                     label: "Спрей" },
  { pattern: /ибупрофен|нурофен/i,                 label: "Ибупрофен" },
  { pattern: /аспирин|ацетилсалицил/i,             label: "Аспирин" },
  { pattern: /парацетамол|панадол/i,               label: "Парацетамол" },
  { pattern: /метоклопрамид|церукал/i,             label: "Метоклопрамид" },
  { pattern: /кеторолак|кетанов|кеторол/i,        label: "Кеторолак" },
  { pattern: /пенталгин/i,                         label: "Пенталгин" },
  { pattern: /спазмалгон/i,                        label: "Спазмалгон" },
  { pattern: /амитриптилин/i,                      label: "Амитриптилин" },
  { pattern: /топирамат|топамакс/i,               label: "Топирамат" },
];

function medMatchesNote(med: Med, note: string): boolean {
  const n = note.toLowerCase();
  const name = med.name.toLowerCase();
  // Direct name match
  if (n.includes(name)) return true;
  // Pattern-based match for known meds
  for (const { pattern, label } of MED_PATTERNS) {
    if (label.toLowerCase() === name && pattern.test(note)) return true;
  }
  return false;
}

function detectMeds(note: string): string[] {
  const found: string[] = [];
  for (const { pattern, label } of MED_PATTERNS) {
    if (pattern.test(note) && !found.includes(label)) found.push(label);
  }
  return found;
}

// ── MedRow ───────────────────────────────────────────────────────────────────

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

      <MonthLabels days={days} />

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: "2px" }}>
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return <div key={`${wi}-${di}`} className="aspect-square" />;
            const taken   = intakeSet.has(day);
            const migrain = migraineSet.has(day);
            const isAsNeededMig = med.isAsNeeded && migrain && !taken;

            let bg = "var(--surface-3)";
            let title = day;
            if (taken) {
              bg = med.isAsNeeded ? "var(--warn, #e8a23a)" : "var(--phase)";
              title = `${day} — принято`;
            } else if (isAsNeededMig) {
              bg = "rgba(232,162,58,0.3)";
              title = `${day} — мигрень, нет отметки`;
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

      {med.isAsNeeded && (
        <div className="mt-2 flex flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: "var(--warn, #e8a23a)" }} />
            <span className="font-mono text-[9px] text-ink-4">принято</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: "rgba(232,162,58,0.3)" }} />
            <span className="font-mono text-[9px] text-ink-4">мигрень без отметки</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MigreBot history section ─────────────────────────────────────────────────

type MigraineDayEntry = {
  date: string;
  meds: string;
  detectedMeds: string[];
};

function MigreBotSection({ entries }: { entries: MigraineDayEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-warn">из дневника мигрени</span>
        <span className="rounded-[2px] bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] text-warn">{entries.length} приступов</span>
      </div>
      <div className="space-y-2.5">
        {entries.map((e) => (
          <div key={e.date} className="flex gap-2">
            <span className="shrink-0 w-[60px] font-mono text-[11px] text-ink-3">
              {e.date.slice(5).replace("-", ".")}
            </span>
            <div className="min-w-0 flex-1">
              {e.detectedMeds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-0.5">
                  {e.detectedMeds.map((m) => (
                    <span key={m} className="rounded-[2px] bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] text-warn">{m}</span>
                  ))}
                </div>
              )}
              <p className="font-sans text-[11px] text-ink-3 leading-snug">{e.meds}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

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

  // migraineSet: days with any migraine event (from daily_log OR migraine_event)
  const migraineSet = new Set(intakeDays.filter((d) => d.migraine).map((d) => d.date));

  // Per-med intake sets
  const medIntakeSets = new Map<string, Set<string>>();
  for (const med of meds) medIntakeSets.set(med.id, new Set());

  for (const day of intakeDays) {
    for (const med of meds) {
      const set = medIntakeSets.get(med.id)!;
      // 1. New-style log: meds_taken array
      if (day.medIds.includes(med.id)) {
        set.add(day.date);
        continue;
      }
      // 2. Historical habits: habit_key match in habits_done
      const habitKey = med.habit_key ?? med.name;
      if (habitKey && day.habitsDone.includes(habitKey)) {
        set.add(day.date);
        continue;
      }
      // 3. MigreBot migraine_event.meds: text match for as-needed meds
      if (med.isAsNeeded && day.migraineMeds && medMatchesNote(med, day.migraineMeds)) {
        set.add(day.date);
      }
    }
  }

  // Collect MigreBot entries with detected meds, sorted desc
  const migreBotEntries: MigraineDayEntry[] = intakeDays
    .filter((d) => d.migraineMeds)
    .map((d) => ({
      date: d.date,
      meds: d.migraineMeds!,
      detectedMeds: detectMeds(d.migraineMeds!),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

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

      <MigreBotSection entries={migreBotEntries} />

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
