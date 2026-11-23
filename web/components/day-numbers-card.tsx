"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDayNumber } from "@/app/(app)/checkin/actions";
import { useSaveQueue, SaveStatus, type SaveRunner } from "@/components/save-queue";

const labelCls = "font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3";
const inputCls =
  "mt-2 min-h-[48px] w-full rounded-[3px] border border-line bg-surface px-4 font-mono text-[17px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-4 outline-none focus:border-phase";

// Вес и калории — одна карточка для «Сегодня» и «Веса». Сохраняется при уходе
// из поля (или по Enter), пустое поле очищает значение. Вес пишется и в
// weight_entry, и в строку дня (saveDayNumber), поэтому оба экрана видят одно.
export function DayNumbersCard({
  weightDay,
  kcalDay,
  initialWeight,
  initialKcal,
  weightPlaceholder,
  kcalLabel = "Ккал за день",
  run: externalRun,
}: {
  weightDay: string;
  kcalDay: string;
  initialWeight: number | null;
  initialKcal: number | null;
  weightPlaceholder?: number | null;
  kcalLabel?: string;
  // На «Сегодня» записи идут через общую очередь экрана; без неё — своя.
  run?: SaveRunner;
}) {
  const router = useRouter();
  const own = useSaveQueue();
  const run = externalRun ?? own.run;
  const [weight, setWeight] = useState(initialWeight != null ? String(initialWeight).replace(".", ",") : "");
  const [kcal, setKcal] = useState(initialKcal != null ? String(initialKcal) : "");
  const saved = useRef({ weight, kcal });

  function commit(field: "weight" | "kcal") {
    const value = field === "weight" ? weight : kcal;
    if (value.trim() === saved.current[field].trim()) return;
    const prev = saved.current[field];
    saved.current = { ...saved.current, [field]: value };
    run(
      async () => {
        const res = await saveDayNumber(field === "weight" ? weightDay : kcalDay, field, value);
        if (res.ok) router.refresh();
        return res;
      },
      () => { saved.current = { ...saved.current, [field]: prev }; },
    );
  }

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <section>
      <div className="flex gap-3">
        <label className="min-w-0 flex-1">
          <span className={labelCls}>Вес, кг</span>
          <input
            id={`weight-${weightDay}`}
            type="text"
            inputMode="decimal"
            value={weight}
            placeholder={weightPlaceholder != null ? String(weightPlaceholder).replace(".", ",") : "кг"}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => commit("weight")}
            onKeyDown={onEnter}
            className={inputCls}
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className={labelCls}>{kcalLabel}</span>
          <input
            id={`kcal-${kcalDay}`}
            type="text"
            inputMode="numeric"
            value={kcal}
            placeholder="—"
            onChange={(e) => setKcal(e.target.value)}
            onBlur={() => commit("kcal")}
            onKeyDown={onEnter}
            className={inputCls}
          />
        </label>
      </div>
      {weightPlaceholder != null && !weight && (
        <p className="mt-1.5 font-sans text-[12px] text-ink-2">Серым — последний записанный вес. Сохранится, только если введёшь.</p>
      )}
      {!externalRun && <SaveStatus state={own.state} error={own.error} />}
    </section>
  );
}
