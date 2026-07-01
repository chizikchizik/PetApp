"use client";

import type { Med, MedIntakeDay } from "@/lib/data";

const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const DOW_LABELS   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildDayRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to) { days.push(cur); cur = addDays(cur, 1); }
  return days;
}

// weeks[i] = 7 days (Mon…Sun) of week i, empty string = padding
function toWeeks(days: string[]): string[][] {
  if (days.length === 0) return [];
  const firstDow = (new Date(days[0] + "T12:00:00").getDay() + 6) % 7; // Mon=0
  const padded = Array(firstDow).fill("").concat(days) as string[];
  // pad end to full weeks
  while (padded.length % 7 !== 0) padded.push("");
  const weeks: string[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

// ── Medication keyword patterns ──────────────────────────────────────────────
// Heuristic substring match over free-text MigreBot notes — can false-positive
// (e.g. "не помог спрей от насморка" would match nasal_spray). Acceptable for a
// history-display heuristic; original text is shown alongside via MigreBotSection
// so the user can always see what was actually written.
const MED_PATTERNS: { pattern: RegExp; ids: string[] }[] = [
  { pattern: /суматриптан|имигран/i,              ids: ["sumatriptan"] },
  { pattern: /нурофен|ибупрофен/i,               ids: ["nurofen"] },
  { pattern: /спрей|назальн/i,                   ids: ["nasal_spray"] },
  { pattern: /спазмалгон/i,                      ids: ["spazmalgon"] },
  { pattern: /пенталгин/i,                       ids: ["pentalgin"] },
  { pattern: /триптаджик/i,                      ids: ["triptadjik"] },
  { pattern: /делмигрен/i,                       ids: ["delmigren"] },
  { pattern: /капориза/i,                        ids: ["kaporiza"] },
  { pattern: /релпакс|элетриптан/i,              ids: ["relpax"] },
  { pattern: /аскофен|аскопар/i,                ids: ["ascofene"] },
  { pattern: /золмитриптан|зомиг/i,             ids: ["zolmitriptan"] },
  { pattern: /ризатриптан|максальт/i,           ids: ["rizatriptan"] },
  { pattern: /парацетамол|панадол/i,            ids: ["paracetamol"] },
  { pattern: /кеторолак|кетанов/i,             ids: ["ketorolac"] },
];

// Detect medication IDs mentioned in a meds text
function detectMedIds(medsText: string): string[] {
  const found: string[] = [];
  for (const { pattern, ids } of MED_PATTERNS) {
    if (pattern.test(medsText)) {
      for (const id of ids) if (!found.includes(id)) found.push(id);
    }
  }
  return found;
}

// Detect human-readable labels from meds text (for display in the log section)
const DISPLAY_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /суматриптан|имигран/i,   label: "Суматриптан" },
  { pattern: /нурофен|ибупрофен/i,    label: "Нурофен" },
  { pattern: /спрей|назальн/i,        label: "Спрей" },
  { pattern: /спазмалгон/i,           label: "Спазмалгон" },
  { pattern: /пенталгин/i,            label: "Пенталгин" },
  { pattern: /триптаджик/i,           label: "Триптаджик" },
  { pattern: /делмигрен/i,            label: "Делмигрен" },
  { pattern: /капориза/i,             label: "Капориза" },
  { pattern: /релпакс|элетриптан/i,  label: "Релпакс" },
  { pattern: /аскофен/i,             label: "Аскофен" },
];

function detectLabels(medsText: string): string[] {
  const found: string[] = [];
  for (const { pattern, label } of DISPLAY_PATTERNS) {
    if (pattern.test(medsText) && !found.includes(label)) found.push(label);
  }
  return found;
}

// ── Heatmap (GitHub-style: columns = weeks, rows = days Mon→Sun) ─────────────

function Heatmap({
  weeks,
  intakeSet,
  migraineSet,
  isAsNeeded,
}: {
  weeks: string[][];
  intakeSet: Set<string>;
  migraineSet: Set<string>;
  isAsNeeded: boolean;
}) {
  const nWeeks = weeks.length;

  // Month labels: first week where a new month appears
  const monthLabels = new Map<number, string>();
  let lastM = -1;
  weeks.forEach((week, wi) => {
    const first = week.find((d) => d);
    if (!first) return;
    const m = parseInt(first.slice(5, 7)) - 1;
    if (m !== lastM) { monthLabels.set(wi, MONTHS_SHORT[m]); lastM = m; }
  });

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {/* Day-of-week labels */}
      <div className="shrink-0 flex flex-col" style={{ paddingTop: "16px" }}>
        {DOW_LABELS.map((label, i) => (
          <div
            key={label}
            className="flex items-center justify-end pr-1"
            style={{ height: "13px", marginBottom: "2px", opacity: i % 2 === 0 ? 1 : 0 }}
          >
            <span className="font-mono text-[8px] text-ink-4">{label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="min-w-0" style={{ flexShrink: 0 }}>
        {/* Month labels row */}
        <div
          className="mb-0.5"
          style={{ display: "grid", gridTemplateColumns: `repeat(${nWeeks}, 13px)`, gap: "2px" }}
        >
          {weeks.map((_, wi) => (
            <div key={wi} className="font-mono text-[8px] text-ink-4 truncate">
              {monthLabels.get(wi) ?? ""}
            </div>
          ))}
        </div>

        {/* Cells: grid-auto-flow column → each week occupies one column */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${nWeeks}, 13px)`,
            gridTemplateRows: "repeat(7, 13px)",
            gridAutoFlow: "column",
            gap: "2px",
          }}
        >
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              if (!day) return <div key={`${wi}-${di}`} />;
              const taken    = intakeSet.has(day);
              const migrain  = migraineSet.has(day);
              const asNeedMig = isAsNeeded && migrain && !taken;

              let bg = "var(--surface-3)";
              let title = day;
              if (taken) {
                bg = isAsNeeded ? "var(--warn, #e8a23a)" : "var(--phase)";
                title = `${day} — принято`;
              } else if (asNeedMig) {
                bg = "rgba(232,162,58,0.28)";
                title = `${day} — мигрень, не зафиксировано`;
              }

              return (
                <div
                  key={`${wi}-${di}`}
                  className="rounded-[2px] transition"
                  style={{ background: bg, width: "13px", height: "13px" }}
                  title={title}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── MedRow ───────────────────────────────────────────────────────────────────

function MedRow({
  med,
  weeks,
  intakeSet,
  migraineSet,
}: {
  med: Med;
  weeks: string[][];
  intakeSet: Set<string>;
  migraineSet: Set<string>;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-2.5 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-sans text-[14px] font-semibold text-ink">{med.name}</span>
            {med.isAsNeeded && (
              <span className="rounded-[2px] bg-warn/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-warn">
                по мигрени
              </span>
            )}
          </div>
          {med.note && <p className="font-mono text-[10px] text-ink-3 mt-0.5">{med.note}</p>}
          {!med.isAsNeeded && med.when && (
            <p className="font-mono text-[10px] text-ink-3 mt-0.5">{med.when}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-[18px] font-bold text-ink leading-none">
            {intakeSet.size}
          </span>
          <span className="block font-mono text-[8px] text-ink-4">дней</span>
        </div>
      </div>

      <Heatmap
        weeks={weeks}
        intakeSet={intakeSet}
        migraineSet={migraineSet}
        isAsNeeded={med.isAsNeeded}
      />

      {med.isAsNeeded && (
        <div className="mt-2 flex flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: "var(--warn, #e8a23a)" }} />
            <span className="font-mono text-[9px] text-ink-4">принято</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: "rgba(232,162,58,0.28)" }} />
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
  labels: string[];
};

function MigreBotSection({ entries }: { entries: MigraineDayEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-warn">
          из дневника мигрени
        </span>
        <span className="rounded-[2px] bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] text-warn">
          {entries.length} приступов
        </span>
      </div>
      <div className="space-y-2.5">
        {entries.map((e) => (
          <div key={e.date} className="flex gap-2">
            <span className="shrink-0 w-[52px] font-mono text-[11px] text-ink-3">
              {e.date.slice(5).replace("-", ".")}
            </span>
            <div className="min-w-0 flex-1">
              {e.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-0.5">
                  {e.labels.map((m) => (
                    <span key={m} className="rounded-[2px] bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] text-warn">
                      {m}
                    </span>
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
  const days  = buildDayRange(fromISO, todayISO);
  const weeks = toWeeks(days);

  const migraineSet = new Set(intakeDays.filter((d) => d.migraine).map((d) => d.date));

  // Per-med intake sets
  const medIntakeSets = new Map<string, Set<string>>();
  for (const med of meds) medIntakeSets.set(med.id, new Set());

  for (const day of intakeDays) {
    // Detect med IDs from MigreBot meds text
    const migraineMedIds = day.migraineMeds ? detectMedIds(day.migraineMeds) : [];

    for (const med of meds) {
      const set = medIntakeSets.get(med.id)!;
      // 1. New-style log via meds_taken[]
      if (day.medIds.includes(med.id)) { set.add(day.date); continue; }
      // 2. Historical habits via habit_key
      const habitKey = med.habit_key ?? med.name;
      if (habitKey && day.habitsDone.includes(habitKey)) { set.add(day.date); continue; }
      // 3. MigreBot migraine_event.meds text match
      if (med.isAsNeeded && migraineMedIds.includes(med.id)) { set.add(day.date); }
    }
  }

  // MigreBot log entries (sorted newest first)
  const migreBotEntries: MigraineDayEntry[] = intakeDays
    .filter((d) => d.migraineMeds)
    .map((d) => ({
      date: d.date,
      meds: d.migraineMeds!,
      labels: detectLabels(d.migraineMeds!),
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
                weeks={weeks}
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
                weeks={weeks}
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
