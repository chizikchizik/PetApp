"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWeight } from "./actions";

export function WeightInput({ dayKey, placeholder }: { dayKey: string; placeholder: number }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    const kg = Number(v.replace(",", "."));
    if (!kg || kg < 20 || kg > 300) return;
    setStatus("saving");
    const r = await saveWeight(dayKey, kg);
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
    <div className="flex gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={v}
        placeholder={`сегодня · ${placeholder}`}
        onChange={(e) => setV(e.target.value)}
        className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-4 py-3 text-[17px] font-semibold text-ink placeholder:text-[15px] placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
      />
      <button
        type="button"
        onClick={save}
        disabled={status === "saving" || !v}
        className="shrink-0 rounded-[3px] bg-phase px-5 text-[15px] font-semibold text-on-phase transition active:scale-[0.98] disabled:opacity-50"
      >
        {status === "saving" ? "…" : status === "saved" ? "✓" : status === "error" ? "!" : "Записать"}
      </button>
    </div>
  );
}
