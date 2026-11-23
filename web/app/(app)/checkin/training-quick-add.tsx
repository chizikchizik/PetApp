"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWorkout } from "../training/actions";
import type { SportType } from "@/lib/data";
import { SportPicker, OTHER_SPORT } from "@/components/sport-picker";

const labelCls = "font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3";

export function TrainingQuickAdd({ dayKey, sportTypes }: { dayKey: string; sportTypes?: SportType[] }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [customType, setCustomType] = useState("");
  const [duration, setDuration] = useState("");
  const [fatigue, setFatigue] = useState(50);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const effectiveType = type === OTHER_SPORT ? customType.trim() : type;

  function close() {
    setOpen(false);
    setType(null);
    setCustomType("");
    setDuration("");
    setFatigue(50);
    setNote("");
    setStatus("idle");
  }

  async function save() {
    if (!effectiveType) return;
    setStatus("saving");
    const res = await saveWorkout(dayKey, {
      type: effectiveType,
      duration: duration ? parseInt(duration) : null,
      fatigue_pct: fatigue,
      note,
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(close, 1200);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2800);
    }
  }

  const fatigueColor =
    fatigue <= 30 ? "var(--phase)" :
    fatigue <= 60 ? "var(--warn, #e8a23a)" :
    "#d04830";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2.5 rounded-card border border-dashed border-line py-3.5 font-mono text-[12px] tracking-[0.08em] uppercase text-ink-3 transition active:opacity-70"
      >
        + записать тренировку
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-2">Тренировка</span>
        <button type="button" onClick={close} aria-label="Закрыть" className="-m-3 grid h-11 w-11 shrink-0 place-items-center font-mono text-[18px] leading-none text-ink-3">×</button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className={labelCls}>Тип</p>
          <SportPicker
            types={sportTypes ?? []}
            value={type}
            custom={customType}
            onPick={(t) => { setType(t); if (t !== OTHER_SPORT) setCustomType(""); }}
            onCustom={setCustomType}
          />
        </div>

        <div>
          <p className={labelCls}>Длительность, мин</p>
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            placeholder="60"
            onChange={(e) => setDuration(e.target.value)}
            className="mt-2 w-full rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[16px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className={labelCls}>Усталость</p>
            <span className="font-mono text-[13px] font-semibold" style={{ color: fatigueColor }}>{fatigue}%</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-mono text-[11px] text-ink-3">лёгко</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={fatigue}
              onChange={(e) => setFatigue(Number(e.target.value))}
              className="h-6 flex-1"
              style={{ accentColor: fatigueColor }}
            />
            <span className="font-mono text-[11px] text-ink-3">выжата</span>
          </div>
        </div>

        <div>
          <p className={labelCls}>Заметка</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что сделала, как прошло…"
            rows={2}
            className="mt-2 w-full resize-none rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </div>

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
