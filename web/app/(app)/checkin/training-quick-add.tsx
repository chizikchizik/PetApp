"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWorkout } from "../training/actions";
import type { SportType } from "@/lib/data";

const FALLBACK_TYPES: SportType[] = [
  { name: "Силовая",        color: "#e8a23a" },
  { name: "Функциональная", color: "#2aa09a" },
  { name: "Бег",            color: "#d05a30" },
  { name: "Групповая",      color: "#8f5ec8" },
];

const labelCls = "font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3";

export function TrainingQuickAdd({ dayKey, sportTypes }: { dayKey: string; sportTypes?: SportType[] }) {
  const router = useRouter();
  const TYPES = sportTypes?.length ? sportTypes : FALLBACK_TYPES;

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [customType, setCustomType] = useState("");
  const [duration, setDuration] = useState("");
  const [fatigue, setFatigue] = useState(50);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const effectiveType = type === "__other__" ? customType.trim() : type;

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
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-2">Тренировка</span>
        <button type="button" onClick={close} className="font-mono text-[18px] leading-none text-ink-3">×</button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className={labelCls}>Тип</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TYPES.map((t) => {
              const on = type === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => { setType(t.name); setCustomType(""); }}
                  className={`flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 font-sans text-[13px] transition ${
                    on ? "border-transparent font-semibold text-white" : "border-line bg-surface text-ink-2"
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
            <button
              type="button"
              onClick={() => setType("__other__")}
              className={`rounded-[3px] border px-3 py-1.5 font-sans text-[13px] transition ${
                type === "__other__" ? "border-ink-2 bg-ink-2 font-semibold text-surface" : "border-line text-ink-3"
              }`}
            >
              Другое
            </button>
          </div>
          {type === "__other__" && (
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Название занятия…"
              autoFocus
              className="mt-2 w-full rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
            />
          )}
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
            <span className="font-mono text-[10px] text-ink-4">лёгко</span>
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
            <span className="font-mono text-[10px] text-ink-4">выжата</span>
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
