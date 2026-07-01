"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "./actions";

export function ProfileForm({
  displayName,
  avgCycleLength,
  weightGoalKg,
  weightStartKg,
}: {
  displayName: string;
  avgCycleLength: number | null;
  weightGoalKg: number | null;
  weightStartKg: number | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [cycle, setCycle] = useState(avgCycleLength != null ? String(avgCycleLength) : "");
  const [goal, setGoal] = useState(weightGoalKg != null ? String(weightGoalKg) : "");
  const [start, setStart] = useState(weightStartKg != null ? String(weightStartKg) : "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const cycleNum = cycle ? Number(cycle.replace(",", ".")) : null;
    const goalNum = goal ? Number(goal.replace(",", ".")) : null;
    const startNum = start ? Number(start.replace(",", ".")) : null;

    if (cycleNum != null && (cycleNum < 15 || cycleNum > 60)) {
      setStatus("error");
      return;
    }

    const r = await saveProfile({
      displayName: name,
      avgCycleLength: cycleNum,
      weightGoalKg: goalNum,
      weightStartKg: startNum,
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
          ? "Ошибка — проверь длину цикла (15–60)"
          : "Сохранить"}
      </button>
    </div>
  );
}
