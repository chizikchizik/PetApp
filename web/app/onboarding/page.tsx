"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCycle, saveWeight, completeOnboarding } from "./actions";
import { isoLocal } from "@/lib/format";

function today() {
  return isoLocal(new Date());
}

type Step = "cycle" | "weight";
const STEPS: Step[] = ["cycle", "weight"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("cycle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [lastPeriod, setLastPeriod] = useState(today());
  const [cycleLen, setCycleLen] = useState(28);

  // Step 2
  const [currentWeight, setCurrentWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");

  const stepIndex = STEPS.indexOf(step);

  function handleNext() {
    setError(null);
    startTransition(async () => {
      try {
        if (step === "cycle") {
          await saveCycle(lastPeriod, cycleLen);
          setStep("weight");
        } else if (step === "weight") {
          await saveWeight(
            currentWeight ? parseFloat(currentWeight) : null,
            goalWeight ? parseFloat(goalWeight) : null
          );
          await completeOnboarding();
          router.push("/");
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  async function handleSkipWeight() {
    setError(null);
    startTransition(async () => {
      try {
        await completeOnboarding();
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5"
      style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))", paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>

      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-phase" : "bg-line"}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col">

        {/* ── Step 1: Cycle ── */}
        {step === "cycle" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 1 / 2</div>
              <h1 className="font-serif font-bold text-[28px] leading-[1.1] uppercase">Твой цикл</h1>
              <p className="mt-2 font-mono text-[12px] text-ink-3">Для отслеживания фаз и прогнозов</p>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">Начало последних месячных</span>
                <input
                  type="date"
                  value={lastPeriod}
                  onChange={(e) => setLastPeriod(e.target.value)}
                  max={today()}
                  className="w-full rounded-card border border-line bg-surface px-4 py-3.5 font-mono text-[15px] text-ink outline-none focus:border-phase"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">Длина цикла (дни)</span>
                <input
                  type="number"
                  value={cycleLen}
                  onChange={(e) => setCycleLen(Number(e.target.value))}
                  min={21}
                  max={45}
                  className="w-full rounded-card border border-line bg-surface px-4 py-3.5 font-mono text-[15px] text-ink outline-none focus:border-phase"
                />
              </label>
            </div>
          </div>
        )}

        {/* ── Step 2: Weight ── */}
        {step === "weight" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 2 / 2</div>
              <h1 className="font-serif font-bold text-[28px] leading-[1.1] uppercase">Вес</h1>
              <p className="mt-2 font-mono text-[12px] text-ink-3">Необязательно — можно заполнить позже в разделе Вес</p>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">Текущий вес (кг)</span>
                <input
                  type="number"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  placeholder="напр. 68"
                  step="0.1"
                  className="w-full rounded-card border border-line bg-surface px-4 py-3.5 font-mono text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">Цель (кг)</span>
                <input
                  type="number"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                  placeholder="напр. 60"
                  step="0.1"
                  className="w-full rounded-card border border-line bg-surface px-4 py-3.5 font-mono text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
                />
              </label>
            </div>
          </div>
        )}

      </div>

      {/* Error */}
      {error && (
        <p className="mt-4 font-mono text-[12px] text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="w-full rounded-card bg-phase py-4 font-mono font-semibold text-[13px] tracking-[0.12em] uppercase text-on-phase disabled:opacity-60"
        >
          {isPending ? "..." : step === "weight" ? "Завершить" : "Далее →"}
        </button>
        {step === "weight" && (
          <button
            type="button"
            onClick={handleSkipWeight}
            disabled={isPending}
            className="w-full rounded-card border border-line py-3.5 font-mono text-[12px] tracking-[0.1em] uppercase text-ink-3"
          >
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}
