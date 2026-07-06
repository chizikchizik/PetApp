"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "./actions";

export function ProfileForm({
  displayName,
  avgCycleLength,
  menstrualDays,
  weightGoalKg,
  weightStartKg,
  workoutYearGoal,
  calorieBalanceKcal,
  calorieGoalKcal,
}: {
  displayName: string;
  avgCycleLength: number | null;
  menstrualDays: number | null;
  weightGoalKg: number | null;
  weightStartKg: number | null;
  workoutYearGoal: number | null;
  calorieBalanceKcal: number | null;
  calorieGoalKcal: number | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [cycle, setCycle] = useState(avgCycleLength != null ? String(avgCycleLength) : "");
  const [critical, setCritical] = useState(menstrualDays != null ? String(menstrualDays) : "");
  const [goal, setGoal] = useState(weightGoalKg != null ? String(weightGoalKg) : "");
  const [start, setStart] = useState(weightStartKg != null ? String(weightStartKg) : "");
  const [workoutGoal, setWorkoutGoal] = useState(workoutYearGoal != null ? String(workoutYearGoal) : "");
  const [calBalance, setCalBalance] = useState(calorieBalanceKcal != null ? String(calorieBalanceKcal) : "");
  const [calGoal, setCalGoal] = useState(calorieGoalKcal != null ? String(calorieGoalKcal) : "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const cycleNum = cycle ? Number(cycle.replace(",", ".")) : null;
    const criticalNum = critical ? Number(critical.replace(",", ".")) : null;
    const goalNum = goal ? Number(goal.replace(",", ".")) : null;
    const startNum = start ? Number(start.replace(",", ".")) : null;
    const workoutGoalNum = workoutGoal ? Number(workoutGoal.replace(",", ".")) : null;
    const calBalanceNum = calBalance ? Number(calBalance.replace(",", ".")) : null;
    const calGoalNum = calGoal ? Number(calGoal.replace(",", ".")) : null;

    if (cycleNum != null && (cycleNum < 15 || cycleNum > 60)) {
      setStatus("error");
      return;
    }
    if (criticalNum != null && (criticalNum < 1 || criticalNum > 15)) {
      setStatus("error");
      return;
    }
    if (workoutGoalNum != null && (workoutGoalNum < 1 || workoutGoalNum > 1000)) {
      setStatus("error");
      return;
    }
    if (calBalanceNum != null && (calBalanceNum < 800 || calBalanceNum > 6000)) {
      setStatus("error");
      return;
    }
    if (calGoalNum != null && (calGoalNum < 800 || calGoalNum > 6000)) {
      setStatus("error");
      return;
    }

    const r = await saveProfile({
      displayName: name,
      avgCycleLength: cycleNum,
      menstrualDays: criticalNum,
      weightGoalKg: goalNum,
      weightStartKg: startNum,
      workoutYearGoal: workoutGoalNum,
      calorieBalanceKcal: calBalanceNum,
      calorieGoalKcal: calGoalNum,
    });
    if (r.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 1600);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2600);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">Имя</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink outline-none focus:border-phase"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          Средняя длина цикла (дней)
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={cycle}
          onChange={(e) => setCycle(e.target.value)}
          placeholder="28"
          className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          Критические дни (дней)
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={critical}
          onChange={(e) => setCritical(e.target.value)}
          placeholder="5"
          className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            Стартовый вес, кг
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink outline-none focus:border-phase"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            Цель, кг
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink outline-none focus:border-phase"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          Цель по тренировкам в год
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={workoutGoal}
          onChange={(e) => setWorkoutGoal(e.target.value)}
          placeholder="150"
          className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            Точка баланса, ккал
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={calBalance}
            onChange={(e) => setCalBalance(e.target.value)}
            placeholder="напр. 2000"
            className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            Цель по калориям
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={calGoal}
            onChange={(e) => setCalGoal(e.target.value)}
            placeholder="напр. 1700"
            className="rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </label>
      </div>
      <p className="-mt-2.5 font-mono text-[9px] leading-relaxed text-ink-3">
        Точка баланса — сколько нужно есть, чтобы вес держался (примерно твой TDEE). Используется для подсветки дефицита/профицита на графике калорий.
      </p>

      <button
        type="button"
        onClick={save}
        disabled={status === "saving"}
        className="mt-1 rounded-[3px] bg-phase px-5 py-3 text-[15px] font-semibold text-on-phase transition active:scale-[0.98] disabled:opacity-50"
      >
        {status === "saving"
          ? "Сохраняю…"
          : status === "saved"
          ? "✓ Сохранено"
          : status === "error"
          ? "Ошибка — проверь длину цикла (15–60), критические дни (1–15), цель тренировок (1–1000) и калории (800–6000)"
          : "Сохранить"}
      </button>
    </div>
  );
}
