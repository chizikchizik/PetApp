"use client";
import { useState, useTransition, useRef } from "react";
import { saveName, saveCycle, saveHabits, saveWeight, completeOnboarding } from "./actions";

const SUGGESTED_HABITS = [
  "Сон до 00:00",
  "Вода 1.5л+",
  "Шаги 10 000",
  "Витамины",
  "Без сахара",
  "Без алкоголя",
  "Растяжка",
  "Медитация",
  "Дефицит ккал",
  "Зарядка",
  "Ранний подъём",
  "Чтение",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

type Step = "name" | "cycle" | "habits" | "weight";
const STEPS: Step[] = ["name", "cycle", "habits", "weight"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("name");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");

  // Step 2
  const [lastPeriod, setLastPeriod] = useState(today());
  const [cycleLen, setCycleLen] = useState(28);

  // Step 3
  const [checkedHabits, setCheckedHabits] = useState<Set<string>>(new Set());
  const [customHabit, setCustomHabit] = useState("");
  const [extraHabits, setExtraHabits] = useState<string[]>([]);

  // Step 4
  const [currentWeight, setCurrentWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");

  const stepIndex = STEPS.indexOf(step);

  function toggleHabit(h: string) {
    setCheckedHabits((prev) => {
      const next = new Set(prev);
      next.has(h) ? next.delete(h) : next.add(h);
      return next;
    });
  }

  function addCustomHabit() {
    const h = customHabit.trim();
    if (!h || extraHabits.includes(h) || SUGGESTED_HABITS.includes(h)) return;
    setExtraHabits((prev) => [...prev, h]);
    setCheckedHabits((prev) => new Set([...prev, h]));
    setCustomHabit("");
  }

  function handleNext() {
    setError(null);
    startTransition(async () => {
      try {
        if (step === "name") {
          if (!name.trim()) { setError("Введи имя"); return; }
          await saveName(name.trim());
          setStep("cycle");
        } else if (step === "cycle") {
          await saveCycle(lastPeriod, cycleLen);
          setStep("habits");
        } else if (step === "habits") {
          await saveHabits([...checkedHabits]);
          setStep("weight");
        } else if (step === "weight") {
          await saveWeight(
            currentWeight ? parseFloat(currentWeight) : null,
            goalWeight ? parseFloat(goalWeight) : null
          );
          await completeOnboarding();
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  const allHabits = [...SUGGESTED_HABITS, ...extraHabits];

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

        {/* ── Step 1: Name ── */}
        {step === "name" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 1 / 4</div>
              <h1 className="font-serif font-bold text-[28px] leading-[1.1] uppercase">Как тебя зовут?</h1>
              <p className="mt-2 font-mono text-[12px] text-ink-3">Это имя будет отображаться в приложении</p>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              placeholder="Имя"
              autoFocus
              className="w-full rounded-card border border-line bg-surface px-4 py-3.5 font-mono text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
            />
          </div>
        )}

        {/* ── Step 2: Cycle ── */}
        {step === "cycle" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 2 / 4</div>
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

        {/* ── Step 3: Habits ── */}
        {step === "habits" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 3 / 4</div>
              <h1 className="font-serif font-bold text-[28px] leading-[1.1] uppercase">Привычки</h1>
              <p className="mt-2 font-mono text-[12px] text-ink-3">Выбери что хочешь отслеживать. Можно изменить позже.</p>
            </div>
            <div className="flex flex-col gap-2">
              {allHabits.map((h) => {
                const checked = checkedHabits.has(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => toggleHabit(h)}
                    className={`flex items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${
                      checked ? "border-phase bg-phase/10 text-ink" : "border-line bg-surface text-ink-2"
                    }`}
                  >
                    <span className={`h-4 w-4 shrink-0 rounded-[3px] border flex items-center justify-center ${
                      checked ? "border-phase bg-phase" : "border-line"
                    }`}>
                      {checked && (
                        <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-on-phase stroke-2">
                          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className="font-mono text-[13px]">{h}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customHabit}
                onChange={(e) => setCustomHabit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomHabit()}
                placeholder="Своя привычка..."
                className="flex-1 rounded-card border border-line bg-surface px-4 py-3 font-mono text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
              />
              <button
                type="button"
                onClick={addCustomHabit}
                disabled={!customHabit.trim()}
                className="rounded-card border border-line bg-surface px-4 font-mono text-[13px] text-phase disabled:opacity-40"
              >
                +
              </button>
            </div>
            {checkedHabits.size === 0 && (
              <p className="font-mono text-[11px] text-ink-3">Можно пропустить и добавить позже</p>
            )}
          </div>
        )}

        {/* ── Step 4: Weight ── */}
        {step === "weight" && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3 mb-3">шаг 4 / 4</div>
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
        {step === "habits" && (
          <button
            type="button"
            onClick={handleNext}
            disabled={isPending}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
}
