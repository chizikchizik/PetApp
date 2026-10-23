"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCycle, saveModules, saveWeight, completeOnboarding } from "./actions";
import { isoLocal } from "@/lib/format";
import { ALL_TRACKED, MODULE_LABELS, type TrackedModules } from "@/lib/tracked-modules";

const MODULE_KEYS: (keyof TrackedModules)[] = ["migraine", "training", "weight"];

function today() {
  return isoLocal(new Date());
}

type Step = "cycle" | "modules" | "weight";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("cycle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [lastPeriod, setLastPeriod] = useState(today());
  const [cycleLen, setCycleLen] = useState(28);

  // Step 2 — что отслеживать (хотя бы один раздел)
  const [tracks, setTracks] = useState<TrackedModules>(ALL_TRACKED);

  // Step 3 — только если вес включён
  const [currentWeight, setCurrentWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");

  const steps: Step[] = tracks.weight ? ["cycle", "modules", "weight"] : ["cycle", "modules"];
  const stepIndex = steps.indexOf(step);
  const isLast = stepIndex === steps.length - 1;

  function toggleModule(key: keyof TrackedModules) {
    setTracks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next.migraine || next.training || next.weight ? next : prev;
    });
  }

  function handleNext() {
    setError(null);
    startTransition(async () => {
      try {
        if (step === "cycle") {
          await saveCycle(lastPeriod, cycleLen);
          setStep("modules");
        } else if (step === "modules") {
          await saveModules(tracks);
          if (tracks.weight) {
            setStep("weight");
          } else {
            await completeOnboarding();
            router.push("/");
            return;
          }
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
        {steps.map((s, i) => (
          <div key={s} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-phase" : "bg-line"}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col">

        {/* ── Step 1: Cycle ── */}
        {step === "cycle" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 1 / {steps.length}</div>
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

        {/* ── Step 2: Modules ── */}
        {step === "modules" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 2 / {steps.length}</div>
              <h1 className="font-serif font-bold text-[28px] leading-[1.1] uppercase">Что отслеживаешь?</h1>
              <p className="mt-2 font-sans text-[13px] text-ink-2">Лишнее можно выключить — оно пропадёт из меню. Изменить можно в профиле.</p>
            </div>
            <div className="flex flex-col gap-2">
              {MODULE_KEYS.map((key) => {
                const on = tracks[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleModule(key)}
                    className={`flex min-h-[56px] items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${
                      on ? "border-phase bg-phase-soft" : "border-line bg-surface"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border-2 ${
                      on ? "border-phase bg-phase text-on-phase" : "border-line text-transparent"
                    }`}>
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-sans text-[15px] font-semibold text-ink">{MODULE_LABELS[key].title}</span>
                      <span className="mt-0.5 block font-sans text-[12px] text-ink-2">{MODULE_LABELS[key].hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Weight ── */}
        {step === "weight" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг {steps.length} / {steps.length}</div>
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
          {isPending ? "..." : isLast ? "Завершить" : "Далее →"}
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
