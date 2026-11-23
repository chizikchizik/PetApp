"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  quickLogMigraine,
  saveMigraineDetails,
  setMedTaken,
  logQuickPain,
  addMigraineTrigger,
  deleteMigraineTrigger,
} from "../checkin/actions";
import { saveWorkout } from "../training/actions";
import { updateCalendarEvent, type CalendarEventRow } from "../training/schedule/actions";
import { TrainingQuickAdd } from "../checkin/training-quick-add";
import { PainQuickLogSheet } from "../checkin/pain-quick-log-sheet";
import { AttackSheet, type MigraineState } from "./attack-sheet";
import { MedsCard } from "./meds-card";
import { useSaveQueue, SaveStatus } from "@/components/save-queue";
import { DayNumbersCard } from "@/components/day-numbers-card";
import type { DailyLog, Med, MigraineTrigger, QuickPainEntry, SportType, WorkoutLogEntry } from "@/lib/data";
import type { TrackedModules } from "@/lib/tracked-modules";


const labelCls = "font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3";

function fromLog(l: DailyLog | null): MigraineState {
  return {
    had: l?.migraine ?? false,
    intensity: l?.migraine_intensity ?? 5,
    aura: l?.migraine_aura ?? false,
    triggers: l?.migraine_triggers ?? [],
  };
}

export function TodayDay({
  dayKey,
  dateLabel,
  initial,
  meds,
  medCounts,
  triggers,
  sportTypes,
  quickPain,
  planned,
  workouts,
  dayWeight,
  weightPlaceholder,
  lastAttackLabel,
  medNote,
  phaseTip,
  tracks,
  kpis,
}: {
  dayKey: string;
  dateLabel: string;
  initial: DailyLog | null;
  meds: Med[];
  medCounts: Record<string, number>;
  triggers: MigraineTrigger[];
  sportTypes: SportType[];
  quickPain: QuickPainEntry[];
  planned: CalendarEventRow[];
  workouts: WorkoutLogEntry[];
  // Вес дня: из чек-ина или из weight_entry (экран «Вес» пишет только туда).
  dayWeight: number | null;
  weightPlaceholder: number | null;
  lastAttackLabel: string | null;
  medNote: string | null;
  phaseTip: { title: string; text: string } | null;
  tracks: TrackedModules;
  kpis: React.ReactNode;
}) {
  const router = useRouter();
  const { state: saveState, error: saveError, run } = useSaveQueue();

  const [migraine, setMigraine] = useState<MigraineState>(() => fromLog(initial));
  // Последнее состояние приступа для async-обработчиков (после await замыкание
  // рендера могло устареть).
  const migraineRef = useRef(migraine);
  useEffect(() => { migraineRef.current = migraine; }, [migraine]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [painOpen, setPainOpen] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [takenKeys, setTakenKeys] = useState<Set<string>>(() => new Set(initial?.habits_done ?? []));
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // ── Мигрень ──
  function logAttack() {
    const prev = migraine;
    setMigraine({ ...migraine, had: true });
    setSheetOpen(true);
    run(() => quickLogMigraine(dayKey), () => setMigraine(prev));
  }

  function changeMigraine(next: MigraineState, debounce = false) {
    setMigraine(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const send = () => run(() => saveMigraineDetails(dayKey, next));
    if (debounce) debounceTimer.current = setTimeout(send, 450);
    else send();
  }

  function undoAttack() {
    setConfirmUndo(false);
    changeMigraine({ ...migraine, had: false });
  }

  // ── Препараты ──
  function toggleMed(med: Med) {
    const on = !takenKeys.has(med.habit_key);
    const flip = (want: boolean) =>
      setTakenKeys((prev) => {
        const next = new Set(prev);
        if (want) next.add(med.habit_key);
        else next.delete(med.habit_key);
        return next;
      });
    flip(on);
    run(() => setMedTaken(dayKey, med.id, on), () => flip(!on));
  }

  // ── Тренировка из расписания ──
  function markPlanned(ev: CalendarEventRow) {
    setMarkingId(ev.id);
    run(async () => {
      const res = await saveWorkout(dayKey, { type: ev.title, duration: ev.duration_min, fatigue_pct: null, note: "" });
      if (!res.ok) return res;
      const upd = await updateCalendarEvent(ev.id, { status: "done" });
      setMarkingId(null);
      router.refresh();
      return upd;
    }, () => setMarkingId(null));
  }

  const asNeeded = meds
    .filter((m) => m.isAsNeeded)
    .sort((a, b) => (medCounts[b.id] ?? 0) - (medCounts[a.id] ?? 0));
  const takenAsNeeded = asNeeded.filter((m) => takenKeys.has(m.habit_key)).map((m) => m.name);
  const plannedOpen = planned.filter((ev) => ev.status === "planned");

  return (
    <>
      {/* ── Приступ ── */}
      {tracks.migraine && (
        <section className="mt-4">
          {!migraine.had ? (
            <>
              <button
                type="button"
                onClick={logAttack}
                className="flex min-h-[64px] w-full flex-col items-start gap-1 rounded-card border-[1.5px] border-warn bg-warn-soft px-4 py-3.5 text-left transition active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 font-sans text-[17px] font-extrabold text-warn">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
                  </svg>
                  Голова болит
                </span>
                <span className="font-mono text-[12px] text-ink-2">
                  {lastAttackLabel ? `последний приступ ${lastAttackLabel}` : "запишу время, детали потом"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPainOpen(true)}
                className="mt-1 min-h-[40px] font-mono text-[12px] text-ink-2 underline underline-offset-2"
              >
                болит что-то другое
              </button>
            </>
          ) : (
            <div className="rounded-card border-[1.5px] border-warn bg-warn-soft px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-sans text-[16px] font-extrabold text-warn">Приступ записан</p>
                  <p className="mt-1 font-sans text-[13px] text-ink-2">
                    сила {migraine.intensity}
                    {migraine.aura ? " · с аурой" : ""}
                    {takenAsNeeded.length > 0 ? ` · ${takenAsNeeded.join(", ")}` : ""}
                    {migraine.triggers.length > 0 ? ` · ${migraine.triggers.join(", ")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="min-h-[40px] shrink-0 rounded-[3px] border border-warn px-3 font-mono text-[12px] font-semibold text-warn"
                >
                  детали
                </button>
              </div>
              {confirmUndo ? (
                <div className="mt-2 flex items-center gap-3">
                  <span className="font-sans text-[13px] text-ink-2">Убрать отметку приступа?</span>
                  <button type="button" onClick={undoAttack} className="min-h-[36px] font-mono text-[12px] font-semibold text-warn">Да</button>
                  <button type="button" onClick={() => setConfirmUndo(false)} className="min-h-[36px] font-mono text-[12px] text-ink-2">Нет</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmUndo(true)}
                  className="mt-1 min-h-[36px] font-mono text-[12px] text-ink-2 underline underline-offset-2"
                >
                  отметила по ошибке
                </button>
              )}
            </div>
          )}

          {quickPain.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {quickPain.map((entry) => (
                <div key={entry.id} className="rounded-[3px] border border-line bg-surface-2 px-3 py-2 font-sans text-[13px] text-ink-2">
                  болело: {entry.painLocation}
                  {entry.medName && ` · ${entry.medName}`}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {kpis}

      {/* ── Препараты ── */}
      <div className="mt-5">
        <MedsCard meds={meds} medCounts={medCounts} takenKeys={takenKeys} onToggle={toggleMed} />
      </div>

      {/* ── Тренировка ── */}
      {tracks.training && (
        <section className="mt-5">
          <span className={labelCls}>Тренировка</span>
          {phaseTip && (
            <p className="mt-2 border-l-2 border-phase pl-2.5 font-sans text-[13px] leading-snug text-ink-2">
              <b className="text-ink">{phaseTip.title}.</b> {phaseTip.text}
            </p>
          )}
          {(workouts.length > 0 || plannedOpen.length > 0) && (
            <div className="mt-2 space-y-2">
              {workouts.map((w, i) => (
                <div key={`${w.type}-${i}`} className="flex min-h-[44px] items-center justify-between rounded-[3px] border border-line bg-surface px-3.5">
                  <span className="font-sans text-[14px] font-semibold text-ink">✓ {w.type}</span>
                  {w.duration_min != null && <span className="font-mono text-[12px] text-ink-2">{w.duration_min} мин</span>}
                </div>
              ))}
              {plannedOpen.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => markPlanned(ev)}
                  disabled={markingId === ev.id}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[3px] border border-dashed border-phase bg-phase-soft px-3.5 text-left disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block font-sans text-[14px] font-semibold text-ink">{ev.title}</span>
                    <span className="block font-mono text-[11px] text-ink-2">
                      по плану{ev.time_start ? ` · ${ev.time_start.slice(0, 5)}` : ""}{ev.duration_min ? ` · ${ev.duration_min} мин` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] font-semibold text-phase-deep">
                    {markingId === ev.id ? "…" : "была ✓"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-2">
            <TrainingQuickAdd dayKey={dayKey} sportTypes={sportTypes} />
          </div>
        </section>
      )}

      {/* ── Вес и калории ── */}
      {tracks.weight && (
        <div className="mt-5">
          <DayNumbersCard
            weightDay={dayKey}
            kcalDay={dayKey}
            initialWeight={dayWeight}
            initialKcal={initial?.calorie_kcal ?? null}
            weightPlaceholder={dayWeight == null ? weightPlaceholder : null}
            run={run}
          />
        </div>
      )}

      {sheetOpen && (
        <AttackSheet
          dateLabel={dateLabel}
          migraine={migraine}
          onMigraineChange={changeMigraine}
          asNeededMeds={asNeeded}
          takenKeys={takenKeys}
          onToggleMed={toggleMed}
          triggers={triggers}
          onAddTrigger={async (name) => {
            await addMigraineTrigger(name);
            const cur = migraineRef.current;
            if (!cur.triggers.includes(name)) changeMigraine({ ...cur, triggers: [...cur.triggers, name] });
            router.refresh();
          }}
          onDeleteTrigger={async (t) => {
            const cur = migraineRef.current;
            if (cur.triggers.includes(t.name)) {
              changeMigraine({ ...cur, triggers: cur.triggers.filter((x) => x !== t.name) });
            }
            await deleteMigraineTrigger(t.id);
            router.refresh();
          }}
          medNote={medNote}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {painOpen && (
        <PainQuickLogSheet
          asNeededMeds={asNeeded}
          onSave={async (location, medId) => {
            const res = await logQuickPain(dayKey, location, medId);
            if (res.ok) {
              setPainOpen(false);
              router.refresh();
            }
          }}
          onClose={() => setPainOpen(false)}
        />
      )}

      <SaveStatus state={saveState} error={saveError} />
    </>
  );
}
