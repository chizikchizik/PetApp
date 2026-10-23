"use client";

import { useEffect, useRef, useState } from "react";
import type { Med, MigraineTrigger } from "@/lib/data";

export type MigraineState = { had: boolean; intensity: number; aura: boolean; triggers: string[] };

const labelCls = "font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3";
const chip = "min-h-[40px] rounded-[3px] border px-3 py-2 font-sans text-[13px] transition";

// Шторка деталей приступа. Открывается сразу после «Голова болит» — сам
// приступ к этому моменту уже записан, всё здесь необязательно.
export function AttackSheet({
  dateLabel,
  migraine,
  onMigraineChange,
  asNeededMeds,
  takenKeys,
  onToggleMed,
  triggers,
  onAddTrigger,
  onDeleteTrigger,
  medNote,
  onClose,
}: {
  dateLabel: string;
  migraine: MigraineState;
  onMigraineChange: (next: MigraineState, debounce?: boolean) => void;
  asNeededMeds: Med[];
  takenKeys: Set<string>;
  onToggleMed: (med: Med) => void;
  triggers: MigraineTrigger[];
  onAddTrigger: (name: string) => Promise<void>;
  onDeleteTrigger: (t: MigraineTrigger) => Promise<void>;
  medNote: string | null;
  onClose: () => void;
}) {
  const [editingTriggers, setEditingTriggers] = useState(false);
  const [newTrigger, setNewTrigger] = useState("");
  const [showAllMeds, setShowAllMeds] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  // onClose приходит новой функцией на каждый рендер родителя — держим её в
  // ref, чтобы эффект ниже отработал один раз при открытии и не уводил фокус
  // с ползунка или поля ввода.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const m = migraine;
  const visibleMeds = showAllMeds ? asNeededMeds : asNeededMeds.filter((med, i) => i < 5 || takenKeys.has(med.habit_key));
  const hiddenCount = asNeededMeds.length - visibleMeds.length;

  async function addTrigger() {
    const name = newTrigger.trim();
    if (!name) return;
    setNewTrigger("");
    await onAddTrigger(name);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Детали приступа"
        className="flex max-h-[88dvh] w-full max-w-[430px] flex-col rounded-t-[14px] border-t border-line-2 bg-surface"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-warn">приступ записан · {dateLabel}</p>
            <p className="mt-1 font-sans text-[17px] font-bold text-ink">Добавить детали?</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid h-11 w-11 shrink-0 place-items-center font-mono text-[20px] leading-none text-ink-3"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
          <p className="font-sans text-[13px] text-ink-2">Всё здесь необязательно — можно закрыть и вернуться позже.</p>

          {/* Сила */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>Сила боли</span>
              <span className="font-mono text-[20px] font-semibold text-warn">{m.intensity}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={m.intensity}
              aria-label="Сила боли от 0 до 10"
              onChange={(e) => onMigraineChange({ ...m, intensity: +e.target.value }, true)}
              className="mt-2 h-8 w-full"
              style={{ accentColor: "var(--warn)" }}
            />
            <div className="flex justify-between font-mono text-[11px] text-ink-3">
              <span>слабая</span><span>сильная</span>
            </div>
          </div>

          {/* Аура */}
          <div>
            <span className={labelCls}>Аура</span>
            <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-[3px] border border-line-2">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={m.aura === v}
                  onClick={() => onMigraineChange({ ...m, aura: v })}
                  className={`min-h-[44px] font-sans text-[14px] transition ${v ? "border-l border-line-2" : ""} ${
                    m.aura === v ? "bg-phase font-semibold text-on-phase" : "text-ink-2"
                  }`}
                >
                  {v ? "Была" : "Не было"}
                </button>
              ))}
            </div>
          </div>

          {/* Препараты */}
          {asNeededMeds.length > 0 && (
            <div>
              <span className={labelCls}>Что приняла</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleMeds.map((med) => {
                  const on = takenKeys.has(med.habit_key);
                  return (
                    <button
                      key={med.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onToggleMed(med)}
                      className={`${chip} ${on ? "border-phase bg-phase-soft font-semibold text-phase-deep" : "border-line-2 bg-surface text-ink-2"}`}
                    >
                      {med.name}{on ? " ✓" : ""}
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button type="button" onClick={() => setShowAllMeds(true)} className={`${chip} border-dashed border-line-2 text-ink-3`}>
                    ещё {hiddenCount}
                  </button>
                )}
              </div>
              {medNote && (
                <p className="mt-2 rounded-[3px] bg-surface-2 px-3 py-2 font-sans text-[12.5px] leading-snug text-ink-2">{medNote}</p>
              )}
            </div>
          )}

          {/* Триггеры */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>Триггеры · если знаешь</span>
              <button
                type="button"
                onClick={() => setEditingTriggers((v) => !v)}
                className="min-h-[36px] font-mono text-[11px] text-ink-2 underline underline-offset-2"
              >
                {editingTriggers ? "готово" : "изменить список"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {triggers.map((t) => {
                const on = m.triggers.includes(t.name);
                return editingTriggers ? (
                  <span key={t.id} className={`${chip} flex items-center gap-1.5 border-line-2 text-ink-2`}>
                    {t.name}
                    <button
                      type="button"
                      onClick={() => onDeleteTrigger(t)}
                      aria-label={`Удалить триггер ${t.name}`}
                      className="-mr-1 grid h-7 w-7 place-items-center text-ink-3"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      onMigraineChange({
                        ...m,
                        triggers: on ? m.triggers.filter((x) => x !== t.name) : [...m.triggers, t.name],
                      })
                    }
                    className={`${chip} ${on ? "border-phase bg-phase-soft font-semibold text-phase-deep" : "border-line-2 bg-surface text-ink-2"}`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            {editingTriggers && (
              <div className="mt-2 flex gap-2">
                <input
                  id="new-trigger"
                  type="text"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTrigger()}
                  placeholder="Новый триггер"
                  className="min-h-[44px] flex-1 rounded-[3px] border border-line-2 bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
                />
                <button
                  type="button"
                  onClick={addTrigger}
                  disabled={!newTrigger.trim()}
                  className="min-h-[44px] shrink-0 rounded-[3px] bg-phase px-4 font-mono text-[12px] font-semibold text-on-phase disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line px-5 pt-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] w-full rounded-[3px] bg-phase font-sans text-[15px] font-bold text-on-phase transition active:scale-[0.99]"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
