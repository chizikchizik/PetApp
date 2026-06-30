"use client";
import { useState } from "react";
import { saveWorkout, saveExercises } from "./actions";
import type { WorkoutTemplate, ExerciseTemplate } from "@/lib/data";

const FALLBACK_TYPES = ["Силовая", "Функциональная", "Бег", "Групповая"];

// Map UI type labels to template type slugs
const TYPE_SLUG: Record<string, string> = {
  "Силовая": "strength",
  "Функциональная": "functional",
  "Бег": "run",
  "Волейбол": "volleyball",
};

type ExerciseRow = ExerciseTemplate & {
  actual_sets: string;
  actual_reps: string;
  actual_weight: string;
  rpe: string;
};

type FormState = {
  type: string | null;
  customType: string;
  date: string;
  duration: string;
  fatigue_pct: number | null;
  note: string;
};

const emptyForm = (): FormState => ({
  type: null,
  customType: "",
  date: new Date().toISOString().slice(0, 10),
  duration: "",
  fatigue_pct: null,
  note: "",
});

type Mode = "form" | "exercises";

export function TrainingForm({ templates, sportTypes }: { templates: WorkoutTemplate[]; sportTypes?: string[] }) {
  const TYPES = [...(sportTypes ?? FALLBACK_TYPES), "Другое"];
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("form");
  const [s, setS] = useState<FormState>(emptyForm());
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exStatus, setExStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const effectiveType = s.type === "Другое" ? s.customType.trim() : s.type;

  function findTemplate(uiType: string | null): WorkoutTemplate | null {
    if (!uiType) return null;
    const slug = TYPE_SLUG[uiType] ?? uiType.toLowerCase();
    return templates.find((t) => t.type === slug) ?? null;
  }

  function buildExerciseRows(template: WorkoutTemplate): ExerciseRow[] {
    return template.exercises.map((ex) => ({
      ...ex,
      actual_sets: ex.target_sets != null ? String(ex.target_sets) : "",
      actual_reps: ex.target_reps ?? "",
      actual_weight: ex.target_weight != null ? String(ex.target_weight) : "",
      rpe: "",
    }));
  }

  function updateRow(idx: number, field: keyof ExerciseRow, value: string) {
    setExercises((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  async function save() {
    if (!effectiveType) return;
    setStatus("saving");
    const res = await saveWorkout(s.date, {
      type: effectiveType,
      duration: s.duration ? parseInt(s.duration) : null,
      fatigue_pct: s.fatigue_pct,
      note: s.note,
    });
    if (res.ok) {
      setStatus("saved");
      const template = findTemplate(s.type);
      if (template && res.id) {
        setWorkoutId(res.id);
        setExercises(buildExerciseRows(template));
        setMode("exercises");
      } else {
        // No template for this type — close normally
        setS(emptyForm());
        setOpen(false);
        setTimeout(() => setStatus("idle"), 2000);
      }
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2800);
    }
  }

  async function saveEx() {
    if (!workoutId) return;
    setExStatus("saving");
    const rows = exercises.map((ex, i) => ({
      exercise_name: ex.exercise_name,
      exercise_slug: ex.exercise_slug ?? null,
      order_index: i,
      target_sets: ex.target_sets ?? null,
      target_reps: ex.target_reps ?? null,
      target_weight: ex.target_weight ?? null,
      actual_sets: ex.actual_sets ? parseInt(ex.actual_sets) : null,
      actual_reps: ex.actual_reps || null,
      actual_weight: ex.actual_weight ? parseFloat(ex.actual_weight) : null,
      rpe: ex.rpe ? parseInt(ex.rpe) : null,
    }));
    const res = await saveExercises(workoutId, rows);
    if (res.ok) {
      setExStatus("saved");
      setTimeout(() => {
        setExStatus("idle");
        setMode("form");
        setS(emptyForm());
        setWorkoutId(null);
        setExercises([]);
        setStatus("idle");
        setOpen(false);
      }, 1200);
    } else {
      setExStatus("error");
      setTimeout(() => setExStatus("idle"), 2800);
    }
  }

  function skipExercises() {
    setMode("form");
    setS(emptyForm());
    setWorkoutId(null);
    setExercises([]);
    setStatus("idle");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3.5 flex w-full items-center justify-center gap-2.5 rounded-card border border-dashed border-line-2 py-4 font-mono text-[12px] tracking-[0.08em] uppercase text-ink-2 transition active:scale-[0.99]"
      >
        + записать тренировку
      </button>
    );
  }

  // ── Exercise entry mode ──
  if (mode === "exercises") {
    return (
      <div className="mt-3.5 space-y-4 rounded-card border border-line bg-surface p-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-phase">тренировка сохранена ✓</p>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">упражнения</p>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[420px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="pb-2 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 pr-2 min-w-[120px]">Упражнение</th>
                <th className="pb-2 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 w-14 text-center">Подх.</th>
                <th className="pb-2 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 w-16 text-center">Повт.</th>
                <th className="pb-2 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 w-16 text-center">Вес кг</th>
                <th className="pb-2 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 w-12 text-center">RPE</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-2 pr-2">
                    <div className="font-sans text-[12px] text-ink leading-tight">{ex.exercise_name}</div>
                    {(ex.target_sets != null || ex.target_reps) && (
                      <div className="font-mono text-[9px] text-ink-3 mt-0.5">
                        план: {[ex.target_sets ? `${ex.target_sets}×` : null, ex.target_reps, ex.target_weight ? `${ex.target_weight}кг` : null].filter(Boolean).join(" ")}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={ex.actual_sets}
                      onChange={(e) => updateRow(i, "actual_sets", e.target.value)}
                      placeholder={ex.target_sets != null ? String(ex.target_sets) : "—"}
                      className="w-full rounded-[3px] border border-line bg-surface px-1.5 py-1.5 text-[13px] text-ink text-center placeholder:text-ink-4 outline-none focus:border-phase"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <input
                      type="text"
                      value={ex.actual_reps}
                      onChange={(e) => updateRow(i, "actual_reps", e.target.value)}
                      placeholder={ex.target_reps ?? "—"}
                      className="w-full rounded-[3px] border border-line bg-surface px-1.5 py-1.5 text-[13px] text-ink text-center placeholder:text-ink-4 outline-none focus:border-phase"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={ex.actual_weight}
                      onChange={(e) => updateRow(i, "actual_weight", e.target.value)}
                      placeholder={ex.target_weight != null ? String(ex.target_weight) : "—"}
                      className="w-full rounded-[3px] border border-line bg-surface px-1.5 py-1.5 text-[13px] text-ink text-center placeholder:text-ink-4 outline-none focus:border-phase"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10}
                      value={ex.rpe}
                      onChange={(e) => updateRow(i, "rpe", e.target.value)}
                      placeholder="—"
                      className="w-full rounded-[3px] border border-line bg-surface px-1.5 py-1.5 text-[13px] text-ink text-center placeholder:text-ink-4 outline-none focus:border-phase"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={skipExercises}
            className="rounded-[3px] border border-line px-4 py-3 text-[13px] font-medium text-ink-3"
          >
            Пропустить
          </button>
          <button
            type="button"
            onClick={saveEx}
            disabled={exStatus === "saving"}
            className="flex-1 rounded-[3px] bg-phase py-3 text-[13px] font-semibold text-on-phase transition active:scale-[0.99] disabled:opacity-50"
          >
            {exStatus === "saving"
              ? "Сохраняю…"
              : exStatus === "saved"
              ? "Сохранено ✓"
              : exStatus === "error"
              ? "Ошибка — повторить"
              : "Сохранить упражнения"}
          </button>
        </div>
      </div>
    );
  }

  // ── Workout entry mode ──
  return (
    <div className="mt-3.5 space-y-4 rounded-card border border-line bg-surface p-4">
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">тип тренировки</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const on = s.type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setS({ ...s, type: t, customType: "" })}
                className={`rounded-[3px] border px-3.5 py-2 text-[13px] font-medium transition ${
                  on ? "border-phase bg-phase-soft font-semibold text-phase-deep" : "border-line bg-surface text-ink-2"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        {s.type === "Другое" && (
          <input
            type="text"
            value={s.customType}
            onChange={(e) => setS({ ...s, customType: e.target.value })}
            placeholder="Название занятия…"
            autoFocus
            className="mt-2.5 w-full rounded-[3px] border border-line bg-surface px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">дата</p>
          <input
            type="date"
            value={s.date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setS({ ...s, date: e.target.value })}
            className="mt-2 w-full rounded-[3px] border border-line bg-surface px-2 py-3 text-[13px] text-ink outline-none focus:border-phase"
          />
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">длительность, мин</p>
          <input
            type="number"
            inputMode="numeric"
            value={s.duration}
            placeholder="60"
            onChange={(e) => setS({ ...s, duration: e.target.value })}
            className="mt-2 w-full rounded-[3px] border border-line bg-surface px-4 py-3 text-[16px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            усталость, % {s.fatigue_pct != null ? `· ${s.fatigue_pct}` : ""}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={s.fatigue_pct ?? 50}
              onChange={(e) => setS({ ...s, fatigue_pct: Number(e.target.value) })}
              className="h-6 flex-1"
              style={{ accentColor: "var(--phase)" }}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">заметка</p>
        <textarea
          value={s.note}
          onChange={(e) => setS({ ...s, note: e.target.value })}
          placeholder="Что сделала, как прошло…"
          rows={2}
          className="mt-2 w-full resize-none rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setS(emptyForm()); }}
          className="rounded-[3px] border border-line px-4 py-3 text-[13px] font-medium text-ink-3"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!effectiveType || status === "saving"}
          className="flex-1 rounded-[3px] bg-phase py-3 text-[13px] font-semibold text-on-phase transition active:scale-[0.99] disabled:opacity-50"
        >
          {status === "saving" ? "Сохраняю…" : status === "saved" ? "Сохранено ✓" : status === "error" ? "Ошибка — повторить" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
