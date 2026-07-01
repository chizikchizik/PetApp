"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWorkout, saveExercises, addSportType } from "./actions";
import type { WorkoutTemplate, ExerciseTemplate, SportType } from "@/lib/data";

const FALLBACK_TYPES: SportType[] = [
  { name: "Силовая",        color: "#e8a23a" },
  { name: "Функциональная", color: "#2aa09a" },
  { name: "Бег",            color: "#d05a30" },
  { name: "Групповая",      color: "#8f5ec8" },
];

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
  fatigue_pct: number;
  note: string;
};

const emptyForm = (): FormState => ({
  type: null,
  customType: "",
  date: new Date().toISOString().slice(0, 10),
  duration: "",
  fatigue_pct: 50,
  note: "",
});

type Mode = "form" | "exercises";

const TYPE_SLUG: Record<string, string> = {
  "Силовая": "strength",
  "Функциональная": "functional",
  "Бег": "run",
  "Волейбол": "volleyball",
};

const labelCls = "font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3";

export function TrainingForm({
  templates,
  sportTypes,
}: {
  templates: WorkoutTemplate[];
  sportTypes?: SportType[];
}) {
  const router = useRouter();
  const TYPES = sportTypes ?? FALLBACK_TYPES;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("form");
  const [s, setS] = useState<FormState>(emptyForm());
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exStatus, setExStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startT] = useTransition();

  const effectiveType = s.type === "__other__" ? s.customType.trim() : s.type;

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

    // Auto-add new sport type to user's list
    if (s.type === "__other__" && s.customType.trim()) {
      startT(async () => {
        await addSportType(s.customType.trim());
        router.refresh();
      });
    }

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
        setS(emptyForm());
        setOpen(false);
        setTimeout(() => setStatus("idle"), 1500);
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

  function close() {
    setOpen(false);
    setS(emptyForm());
    setStatus("idle");
  }

  const fatigue = s.fatigue_pct;
  const fatigueColor =
    fatigue <= 30 ? "var(--phase)" :
    fatigue <= 60 ? "var(--warn, #e8a23a)" :
    "#d04830";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3.5 flex w-full items-center justify-center gap-2.5 rounded-card border border-dashed border-line py-4 font-mono text-[12px] tracking-[0.08em] uppercase text-ink-3 transition active:opacity-70"
      >
        + записать тренировку
      </button>
    );
  }

  // ── Exercises mode ──────────────────────────────────────────────────────────
  if (mode === "exercises") {
    return (
      <div className="mt-3.5 rounded-card border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-phase">тренировка сохранена ✓</p>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">упражнения</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left">
            <thead>
              <tr className="border-b border-line">
                {["Упражнение", "Подх.", "Повт.", "Вес кг", "RPE"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 ${i === 0 ? "min-w-[120px]" : "w-14 text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-sans text-[12px] text-ink">{ex.exercise_name}</div>
                    {(ex.target_sets != null || ex.target_reps) && (
                      <div className="font-mono text-[9px] text-ink-4 mt-0.5">
                        {[ex.target_sets ? `${ex.target_sets}×` : null, ex.target_reps, ex.target_weight ? `${ex.target_weight}кг` : null].filter(Boolean).join(" ")}
                      </div>
                    )}
                  </td>
                  {["actual_sets", "actual_reps", "actual_weight", "rpe"].map((field) => (
                    <td key={field} className="px-1 py-2">
                      <input
                        type={field === "actual_reps" ? "text" : "number"}
                        inputMode={field === "actual_weight" ? "decimal" : "numeric"}
                        value={String((ex as Record<string, unknown>)[field] ?? "")}
                        onChange={(e) => updateRow(i, field as keyof ExerciseRow, e.target.value)}
                        placeholder="—"
                        className="w-full rounded-[2px] border border-line bg-surface px-1.5 py-1.5 text-[13px] text-ink text-center placeholder:text-ink-4 outline-none focus:border-phase"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 p-4">
          <button type="button" onClick={skipExercises} className="rounded-[3px] border border-line px-4 py-3 text-[13px] text-ink-3">
            Пропустить
          </button>
          <button
            type="button"
            onClick={saveEx}
            disabled={exStatus === "saving"}
            className="flex-1 rounded-[3px] bg-phase py-3 text-[13px] font-semibold text-on-phase disabled:opacity-50"
          >
            {exStatus === "saving" ? "…" : exStatus === "saved" ? "Сохранено ✓" : exStatus === "error" ? "Ошибка" : "Сохранить упражнения"}
          </button>
        </div>
      </div>
    );
  }

  // ── Workout entry mode ──────────────────────────────────────────────────────
  return (
    <div className="mt-3.5 rounded-card border border-line bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-2">Новая тренировка</span>
        <button type="button" onClick={close} className="font-mono text-[18px] leading-none text-ink-3">×</button>
      </div>

      <div className="space-y-4 p-4">
        {/* Sport type chips */}
        <div>
          <p className={labelCls}>Тип</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TYPES.map((t) => {
              const on = s.type === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setS({ ...s, type: t.name, customType: "" })}
                  className={`flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 font-sans text-[13px] transition ${
                    on
                      ? "border-transparent font-semibold text-white"
                      : "border-line bg-surface text-ink-2"
                  }`}
                  style={on ? { background: t.color, borderColor: t.color } : {}}
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full transition"
                    style={{ background: on ? "rgba(255,255,255,0.8)" : t.color }}
                  />
                  {t.name}
                </button>
              );
            })}
            {/* Other */}
            <button
              type="button"
              onClick={() => setS({ ...s, type: "__other__" })}
              className={`rounded-[3px] border px-3 py-1.5 font-sans text-[13px] transition ${
                s.type === "__other__"
                  ? "border-ink-2 bg-ink-2 font-semibold text-surface"
                  : "border-line text-ink-3"
              }`}
            >
              Другое
            </button>
          </div>
          {s.type === "__other__" && (
            <input
              type="text"
              value={s.customType}
              onChange={(e) => setS({ ...s, customType: e.target.value })}
              placeholder="Название занятия…"
              autoFocus
              className="mt-2 w-full rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
            />
          )}
          {s.type === "__other__" && s.customType.trim() && (
            <p className="mt-1 font-mono text-[10px] text-ink-3">
              «{s.customType.trim()}» добавится в твой список видов
            </p>
          )}
        </div>

        {/* Date + Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={labelCls}>Дата</p>
            <input
              type="date"
              value={s.date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setS({ ...s, date: e.target.value })}
              className="mt-2 w-full rounded-[3px] border border-line bg-surface px-2 py-2.5 text-[13px] text-ink outline-none focus:border-phase"
            />
          </div>
          <div>
            <p className={labelCls}>Длительность, мин</p>
            <input
              type="number"
              inputMode="numeric"
              value={s.duration}
              placeholder="60"
              onChange={(e) => setS({ ...s, duration: e.target.value })}
              className="mt-2 w-full rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[16px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
            />
          </div>
        </div>

        {/* Fatigue slider */}
        <div>
          <div className="flex items-center justify-between">
            <p className={labelCls}>Усталость</p>
            <span className="font-mono text-[13px] font-semibold" style={{ color: fatigueColor }}>
              {fatigue}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-mono text-[10px] text-ink-4">лёгко</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={fatigue}
              onChange={(e) => setS({ ...s, fatigue_pct: Number(e.target.value) })}
              className="h-6 flex-1"
              style={{ accentColor: fatigueColor }}
            />
            <span className="font-mono text-[10px] text-ink-4">выжата</span>
          </div>
        </div>

        {/* Note */}
        <div>
          <p className={labelCls}>Заметка</p>
          <textarea
            value={s.note}
            onChange={(e) => setS({ ...s, note: e.target.value })}
            placeholder="Что сделала, как прошло…"
            rows={2}
            className="mt-2 w-full resize-none rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={save}
          disabled={!effectiveType || status === "saving"}
          className="w-full rounded-[3px] bg-phase py-3.5 font-semibold text-[14px] text-on-phase transition active:scale-[0.99] disabled:opacity-50"
        >
          {status === "saving" ? "Сохраняю…" : status === "saved" ? "Сохранено ✓" : status === "error" ? "Ошибка — повторить" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
