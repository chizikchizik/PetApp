"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPregnancy } from "./actions";

// Тексты и поведение — по ревью Елены: сервисный тон, без поздравлений при
// включении и без реакций/вопросов при выключении (беременность бывает и
// желанной, и сложной темой — UX одинаковый для любой причины).
export function PregnancyToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [justOff, setJustOff] = useState(false);
  const [saving, startT] = useTransition();

  function apply(on: boolean) {
    startT(async () => {
      const r = await setPregnancy(on);
      if (r.ok) {
        setConfirming(false);
        if (!on) setJustOff(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            Беременность
          </p>
          <p className="mt-1 font-sans text-[12px] leading-snug text-ink-2">
            {active
              ? "Статус включён — фазы цикла, цели по весу и фазовые рекомендации скрыты."
              : "Скрывает фазы цикла, цели по весу и фазовые рекомендации. Наблюдения продолжаются."}
          </p>
        </div>
        {active ? (
          <button
            type="button"
            onClick={() => apply(false)}
            disabled={saving}
            className="shrink-0 rounded-[3px] border border-line px-3.5 py-2 font-mono text-[11px] text-ink-2 transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "…" : "Выключить"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            className="shrink-0 rounded-[3px] border border-line px-3.5 py-2 font-mono text-[11px] text-ink-2 transition active:scale-[0.98]"
          >
            {confirming ? "Отмена" : "Включить"}
          </button>
        )}
      </div>

      {justOff && !active && (
        <p className="mt-2 font-mono text-[11px] text-ink-3">
          Статус выключен. Фазы цикла возобновятся, когда отметишь первую менструацию.
        </p>
      )}

      {confirming && !active && (
        <div className="mt-3 rounded-[3px] border border-line bg-surface-2 p-3.5">
          <p className="font-sans text-[12.5px] leading-[1.55] text-ink-2">
            Фазы цикла, цели по весу и фазовые рекомендации будут скрыты — наблюдения
            продолжатся. Во время беременности обсуди с врачом все препараты и добавки —
            и постоянные, и для купирования. Не отменяй назначенное самостоятельно.
          </p>
          <button
            type="button"
            onClick={() => apply(true)}
            disabled={saving}
            className="mt-3 w-full rounded-[3px] bg-phase py-2.5 font-mono text-[12px] font-semibold text-on-phase transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "…" : "Включить статус"}
          </button>
        </div>
      )}
    </div>
  );
}
