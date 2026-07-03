"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Med, MedIntakeDay, QuickPainEntry } from "@/lib/data";
import { setMedDrugClass } from "../actions";
import { MIGREBOT_MED_PATTERNS, detectMedLabels } from "@/lib/migrebot-meds";

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
//
// Matches by NAME against the user's actual active medications (not a fixed id
// table) — a static id like "sumatriptan" only lines up with a real medication
// row if one happens to exist under that exact id. Custom-added meds always get
// a `custom_<timestamp>` id, so the old fixed-id table silently never matched
// them even when the name was an exact match (e.g. a self-added "Суматриптан").
// Patterns themselves live in lib/migrebot-meds.ts, shared with the import
// action's auto-registration so the two can never drift apart again.

// Detect medication ids mentioned in a meds text, resolved against the user's
// own active medications by name (see comment above).
function detectMedIds(medsText: string, meds: Med[]): string[] {
  const found: string[] = [];
  for (const { pattern } of MIGREBOT_MED_PATTERNS) {
    if (!pattern.test(medsText)) continue;
    for (const med of meds) {
      if (pattern.test(med.name) && !found.includes(med.id)) found.push(med.id);
    }
  }
  return found;
}

// detectLabels (for display in the log section) is detectMedLabels, imported above.
const detectLabels = detectMedLabels;

// ── Классификация препарата для счётчика МИГБ ───────────────────────────────
// Подсказки только по однозначным МНН (международным непатентованным
// названиям) — фармакологический факт, не догадка. Для непонятных брендов
// (Эксенза, Делмигрен, Капориза, Триптаджик и т.п.) подсказки нет вообще —
// пользователь выбирает сам или отмечает "не уверена", см. рекомендацию
// Елены в feedback-dev-patterns.
const CLASS_HINTS: { pattern: RegExp; drugClass: string; label: string }[] = [
  { pattern: /суматриптан|золмитриптан|ризатриптан|наратриптан|элетриптан|имигран|зомиг|максальт/i, drugClass: "triptan", label: "триптан" },
  { pattern: /ибупрофен|нурофен|парацетамол|панадол|аспирин|напроксен/i, drugClass: "nsaid", label: "НПВС" },
  { pattern: /метамизол|анальгин|спазмалгон|пенталгин|аскофен|кеторолак|кетанов/i, drugClass: "combination_analgesic", label: "комбинированный анальгетик" },
];

function suggestDrugClass(name: string): { drugClass: string; label: string } | null {
  for (const h of CLASS_HINTS) if (h.pattern.test(name)) return { drugClass: h.drugClass, label: h.label };
  return null;
}

const CLASS_LABELS: Record<string, string> = {
  triptan: "Триптан",
  nsaid: "НПВС",
  combination_analgesic: "Комбинированный",
  unsure: "Не уверена",
};

function DrugClassPrompt({ meds }: { meds: Med[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startT] = useTransition();

  const pending = meds.filter((m) => m.isAsNeeded && m.drugClass === "unclassified");
  if (pending.length === 0) return null;

  function apply(medId: string, drugClass: string) {
    setBusyId(medId);
    startT(async () => {
      await setMedDrugClass(medId, drugClass);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface p-3.5">
      <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">
        {pending.length} {pending.length === 1 ? "приём" : "приёма"} без указанного типа
      </p>
      <p className="mt-1 font-sans text-[11.5px] leading-relaxed text-ink-3">
        Не учитываются в счётчике риска. Укажи тип препарата — это не диагноз, просто чтобы точно считалось.
      </p>
      <div className="mt-3 space-y-2.5">
        {pending.map((med) => {
          const hint = suggestDrugClass(med.name);
          const busy = busyId === med.id;
          return (
            <div key={med.id} className="rounded-[3px] border border-line bg-surface-2 p-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-sans text-[13px] font-semibold text-ink">{med.name}</span>
                {hint && (
                  <button
                    type="button"
                    onClick={() => apply(med.id, hint.drugClass)}
                    disabled={busy}
                    className="font-mono text-[10px] text-phase underline underline-offset-2 disabled:opacity-50"
                  >
                    похоже на {hint.label} · подтвердить
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(["triptan", "nsaid", "combination_analgesic", "unsure"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => apply(med.id, c)}
                    disabled={busy}
                    className="rounded-[2px] border border-line px-2 py-1 font-mono text-[10px] text-ink-2 transition active:bg-surface-3 disabled:opacity-50"
                  >
                    {CLASS_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
            <div
              key={wi}
              className="font-mono text-[8px] text-ink-4"
              style={{ whiteSpace: "nowrap", overflow: "visible" }}
            >
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

// ── Supplement calendar (one combined heatmap, per-cell letter codes) ───────
// Several supplements are often taken together on the same day; showing one
// GitHub-style square per supplement per day made the "Витамины" block a
// stack of near-identical cards. Instead: one heatmap, one cell per day,
// letter code(s) inside the cell for whichever supplement(s) were taken.

// Curated codes for the admin account's known supplements — purely cosmetic
// preference (e.g. "D" reads better than an auto-picked prefix). For any
// other name (any other user's own supplements), assignCodes() below falls
// back to its collision-safe auto-assignment, so this never causes two
// different supplements to render the same letter.
const SUPPLEMENT_CODE_HINTS: Record<string, string> = {
  "Витамин D": "D",
  "Калия Йодид": "Й",
  "Фолиевая кислота": "Ф",
  "Магний": "М",
  "Витамины": "В",
};

// Assigns a short, unique-per-call display code to each name. `preferred`
// gives cosmetic hints (used only if they don't collide); everything else
// gets the shortest unique prefix, extending on collision and finally
// falling back to a numeric suffix — this is what keeps the merged
// heatmap correct for every user's own, unpredictable set of medication
// names, not just the admin account's.
function assignCodes(names: string[], preferred: Record<string, string> = {}): Record<string, string> {
  const codes: Record<string, string> = {};
  const used = new Set<string>();
  for (const name of names) {
    const hint = preferred[name];
    if (hint && !used.has(hint)) {
      codes[name] = hint;
      used.add(hint);
    }
  }
  for (const name of names) {
    if (codes[name]) continue;
    let len = 1;
    let candidate = name.slice(0, len).toUpperCase();
    while (used.has(candidate) && len < name.length) {
      len++;
      candidate = name.slice(0, len).toUpperCase();
    }
    let suffix = 2;
    while (used.has(candidate)) { candidate = name.slice(0, len).toUpperCase() + suffix; suffix++; }
    codes[name] = candidate;
    used.add(candidate);
  }
  return codes;
}

function SupplementHeatmap({
  weeks,
  supplements,
  codes,
}: {
  weeks: string[][];
  supplements: { med: Med; intakeSet: Set<string> }[];
  codes: Record<string, string>;
}) {
  const nWeeks = weeks.length;

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

      <div className="min-w-0" style={{ flexShrink: 0 }}>
        <div
          className="mb-0.5"
          style={{ display: "grid", gridTemplateColumns: `repeat(${nWeeks}, 13px)`, gap: "2px" }}
        >
          {weeks.map((_, wi) => (
            <div
              key={wi}
              className="font-mono text-[8px] text-ink-4"
              style={{ whiteSpace: "nowrap", overflow: "visible" }}
            >
              {monthLabels.get(wi) ?? ""}
            </div>
          ))}
        </div>

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
              const active = supplements.filter((s) => s.intakeSet.has(day));
              const bg = active.length > 0 ? "var(--phase)" : "var(--surface-3)";
              const label = active.map((s) => codes[s.med.name] ?? "").join("");
              const title = active.length > 0
                ? `${day} — ${active.map((s) => s.med.name).join(", ")}`
                : day;
              return (
                <div
                  key={`${wi}-${di}`}
                  className="flex items-center justify-center rounded-[2px] transition"
                  style={{ background: bg, width: "13px", height: "13px" }}
                  title={title}
                >
                  {active.length > 0 && (
                    <span
                      className="font-mono font-bold leading-none"
                      style={{ fontSize: active.length > 1 ? "5px" : "7px", color: "var(--on-phase)" }}
                    >
                      {label}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SupplementCalendar({
  supplements,
  weeks,
}: {
  supplements: { med: Med; intakeSet: Set<string> }[];
  weeks: string[][];
}) {
  if (supplements.length === 0) return null;
  const anyDay = new Set<string>();
  for (const s of supplements) for (const d of s.intakeSet) anyDay.add(d);
  const codes = assignCodes(supplements.map((s) => s.med.name), SUPPLEMENT_CODE_HINTS);

  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-2.5 flex items-start gap-2">
        <span className="flex-1 font-sans text-[14px] font-semibold text-ink">Витамины</span>
        <div className="shrink-0 text-right">
          <span className="font-mono text-[18px] font-bold text-ink leading-none">{anyDay.size}</span>
          <span className="block font-mono text-[8px] text-ink-4">дней</span>
        </div>
      </div>

      <SupplementHeatmap weeks={weeks} supplements={supplements} codes={codes} />

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
        {supplements.map(({ med, intakeSet }) => (
          <div key={med.id} className="flex items-center gap-1">
            <span
              className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-[1px] px-0.5 font-mono text-[8px] font-bold"
              style={{ background: "var(--phase-soft)", color: "var(--phase-deep)" }}
            >
              {codes[med.name]}
            </span>
            <span className="font-mono text-[9px] text-ink-4">{med.name} · {intakeSet.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── As-needed (abortive) calendar — one combined heatmap, dynamic codes ─────
// Uses the same assignCodes() as the supplement calendar above, with no
// cosmetic hints — the as-needed med list is fully user-defined and
// open-ended (Суматриптан, Нурофен, Спрей, Делмигрен, …).

function AsNeededHeatmap({
  weeks,
  meds,
  intakeSets,
  migraineSet,
  codes,
}: {
  weeks: string[][];
  meds: Med[];
  intakeSets: Map<string, Set<string>>;
  migraineSet: Set<string>;
  codes: Record<string, string>;
}) {
  const nWeeks = weeks.length;

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

      <div className="min-w-0" style={{ flexShrink: 0 }}>
        <div
          className="mb-0.5"
          style={{ display: "grid", gridTemplateColumns: `repeat(${nWeeks}, 13px)`, gap: "2px" }}
        >
          {weeks.map((_, wi) => (
            <div
              key={wi}
              className="font-mono text-[8px] text-ink-4"
              style={{ whiteSpace: "nowrap", overflow: "visible" }}
            >
              {monthLabels.get(wi) ?? ""}
            </div>
          ))}
        </div>

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
              const active = meds.filter((m) => intakeSets.get(m.id)?.has(day));
              const migraineNoMed = active.length === 0 && migraineSet.has(day);
              let bg = "var(--surface-3)";
              if (active.length > 0) bg = "var(--warn, #e8a23a)";
              else if (migraineNoMed) bg = "rgba(232,162,58,0.28)";
              const label = active.map((m) => codes[m.name] ?? "").join("");
              const title = active.length > 0
                ? `${day} — ${active.map((m) => m.name).join(", ")}`
                : migraineNoMed ? `${day} — мигрень, не зафиксировано` : day;
              return (
                <div
                  key={`${wi}-${di}`}
                  className="flex items-center justify-center rounded-[2px] transition"
                  style={{ background: bg, width: "13px", height: "13px" }}
                  title={title}
                >
                  {active.length > 0 && (
                    <span
                      className="font-mono font-bold leading-none"
                      style={{ fontSize: active.length > 1 ? "5px" : "7px", color: "#fff" }}
                    >
                      {label}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function AsNeededCalendar({
  meds,
  weeks,
  intakeSets,
  migraineSet,
}: {
  meds: Med[];
  weeks: string[][];
  intakeSets: Map<string, Set<string>>;
  migraineSet: Set<string>;
}) {
  if (meds.length === 0) return null;
  const codes = assignCodes(meds.map((m) => m.name));
  const anyDay = new Set<string>();
  for (const med of meds) for (const d of intakeSets.get(med.id) ?? []) anyDay.add(d);

  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-2.5 flex items-start gap-2">
        <span className="flex-1 font-sans text-[14px] font-semibold text-ink">По факту мигрени</span>
        <div className="shrink-0 text-right">
          <span className="font-mono text-[18px] font-bold text-ink leading-none">{anyDay.size}</span>
          <span className="block font-mono text-[8px] text-ink-4">дней</span>
        </div>
      </div>

      <AsNeededHeatmap weeks={weeks} meds={meds} intakeSets={intakeSets} migraineSet={migraineSet} codes={codes} />

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
        {meds.map((med) => (
          <div key={med.id} className="flex items-center gap-1">
            <span
              className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-[1px] px-0.5 font-mono text-[8px] font-bold"
              style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
            >
              {codes[med.name]}
            </span>
            <span className="font-mono text-[9px] text-ink-4">{med.name} · {(intakeSets.get(med.id) ?? new Set()).size}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: "rgba(232,162,58,0.28)" }} />
          <span className="font-mono text-[9px] text-ink-4">мигрень без отметки</span>
        </div>
      </div>
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

function QuickPainSection({ entries }: { entries: QuickPainEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">
          разовые записи · другая боль
        </span>
        <span className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-ink-3">
          {entries.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.id} className="flex gap-2">
            <span className="shrink-0 w-[52px] font-mono text-[11px] text-ink-3">
              {e.logDate.slice(5).replace("-", ".")}
            </span>
            <p className="font-sans text-[12px] text-ink-2">
              {e.painLocation}
              {e.medName && ` · ${e.medName}`}
            </p>
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
  quickPainEntries = [],
}: {
  meds: Med[];
  intakeDays: MedIntakeDay[];
  fromISO: string;
  todayISO: string;
  quickPainEntries?: QuickPainEntry[];
}) {
  const days  = buildDayRange(fromISO, todayISO);
  const weeks = toWeeks(days);

  const migraineSet = new Set(intakeDays.filter((d) => d.migraine).map((d) => d.date));

  // Per-med intake sets
  const medIntakeSets = new Map<string, Set<string>>();
  for (const med of meds) medIntakeSets.set(med.id, new Set());

  for (const day of intakeDays) {
    // Detect med IDs from MigreBot meds text
    const migraineMedIds = day.migraineMeds ? detectMedIds(day.migraineMeds, meds) : [];

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

  const regularMeds     = meds.filter((m) => !m.isAsNeeded && !m.isSupplement);
  const supplementMeds  = meds.filter((m) => !m.isAsNeeded && m.isSupplement);
  // "По факту мигрени" препараты с 0 приёмов в периоде — не показываем
  // (это в основном шум от эвристики MigreBot-регэкспа по чужим заметкам,
  // а не реально принимавшиеся препараты). Регулярные не фильтруем — там
  // 0 приёмов сама по себе значимая информация (пропуск профилактики).
  const asNeededMeds = meds.filter((m) => m.isAsNeeded && (medIntakeSets.get(m.id)?.size ?? 0) > 0);

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
      <DrugClassPrompt meds={meds} />

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

      {supplementMeds.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">Витамины</p>
          <SupplementCalendar
            supplements={supplementMeds.map((med) => ({ med, intakeSet: medIntakeSets.get(med.id) ?? new Set<string>() }))}
            weeks={weeks}
          />
        </div>
      )}

      {asNeededMeds.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">По факту мигрени</p>
          <AsNeededCalendar
            meds={asNeededMeds}
            weeks={weeks}
            intakeSets={medIntakeSets}
            migraineSet={migraineSet}
          />
        </div>
      )}

      <MigreBotSection entries={migreBotEntries} />
      <QuickPainSection entries={quickPainEntries} />

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
