"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MODULE_LABELS, type TrackedModules } from "@/lib/tracked-modules";
import { saveTrackedModules } from "./actions";

const KEYS: (keyof TrackedModules)[] = ["migraine", "training", "weight"];

// Переключатели сохраняются сразу, без отдельной кнопки. Последний включённый
// раздел выключить нельзя — тумблер становится неактивным.
export function TrackedModulesForm({ initial }: { initial: TrackedModules }) {
  const router = useRouter();
  const [tracks, setTracks] = useState<TrackedModules>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, startT] = useTransition();
  const onCount = KEYS.filter((k) => tracks[k]).length;

  function toggle(key: keyof TrackedModules) {
    const next = { ...tracks, [key]: !tracks[key] };
    if (!next.migraine && !next.training && !next.weight) return;
    const prev = tracks;
    setTracks(next);
    setError(null);
    startT(async () => {
      const r = await saveTrackedModules(next);
      if (r.ok) router.refresh();
      else {
        setTracks(prev);
        setError(r.error ?? "Не сохранилось — попробуй ещё раз");
      }
    });
  }

  return (
    <section className="mt-5">
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">Что отслеживаю</p>
      <div className="mt-2 overflow-hidden rounded-card border border-line bg-surface">
        {KEYS.map((key) => {
          const on = tracks[key];
          const locked = on && onCount === 1;
          return (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(key)}
              disabled={locked || saving}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 disabled:cursor-default"
            >
              <span className="min-w-0">
                <span className="block font-sans text-[14px] font-semibold text-ink">{MODULE_LABELS[key].title}</span>
                <span className="mt-0.5 block font-sans text-[12px] text-ink-2">
                  {locked ? "последний включённый раздел" : MODULE_LABELS[key].hint}
                </span>
              </span>
              <span
                aria-hidden
                className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? "bg-phase" : "bg-surface-3"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-all ${on ? "left-[18px]" : "left-0.5"}`}
                />
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 font-sans text-[12px] text-ink-2">
        Выключенный раздел пропадает из меню и с экрана «Сегодня». Записи сохраняются.
      </p>
      {error && <p className="mt-1.5 font-mono text-[11px] text-warn">{error}</p>}
    </section>
  );
}
