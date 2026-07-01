"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCheckin, savePeriodStart, createMed, deleteMed, type CheckinPayload } from "./actions";
import type { DailyLog, Med } from "@/lib/data";

const TRIGGERS = ["Цикл", "Сон", "Пропуск еды", "Стресс", "Экран", "Погода", "Алкоголь"];

type State = CheckinPayload & { periodStart: boolean };

const empty: State = {
  mood: null,
  energy: null,
  symptoms: [],
  migraine: { had: false, intensity: 5, aura: false, triggers: [] },
  weight: "",
  kcal: "",
  meds: {},
  habits: [],
  note: "",
  periodStart: false,
};

function fromLog(l: DailyLog | null): State {
  if (!l) return empty;
  return {
    mood: l.mood,
    energy: l.energy,
    symptoms: l.symptoms ?? [],
    migraine: {
      had: l.migraine,
      intensity: l.migraine_intensity ?? 5,
      aura: l.migraine_aura,
      triggers: l.migraine_triggers ?? [],
    },
    weight: l.weight_kg != null ? String(l.weight_kg) : "",
    kcal: l.calorie_kcal != null ? String(l.calorie_kcal) : "",
    meds: Object.fromEntries((l.meds_taken ?? []).map((id) => [id, true])),
    habits: l.habits_done ?? [],
    note: l.note ?? "",
    periodStart: false,
  };
}

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const SPORT_HABITS = new Set<string>(["Спорт", "Бег"]);

const labelCls = "font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3";
const chipBase = "rounded-[2px] border px-[13px] py-[9px] font-sans text-[13px] transition";

export function CheckinForm({
  dayKey,
  todayISO,
  initial,
  habits,
  meds,
  weightPlaceholder,
}: {
  dayKey: string;
  todayISO: string;
  initial: DailyLog | null;
  habits: string[];
  meds: Med[];
  weightPlaceholder: number | null;
}) {
  const router = useRouter();
  const [s, setS] = useState<State>(() => {
    const state = fromLog(initial);
    if (!state.weight && weightPlaceholder) state.weight = String(weightPlaceholder);
    return state;
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedWithPeriod, setSavedWithPeriod] = useState(false);
  const [addingMed, setAddingMed] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedWhen, setNewMedWhen] = useState("");
  const [newMedAsNeeded, setNewMedAsNeeded] = useState(false);
  const [addMedStatus, setAddMedStatus] = useState<"idle" | "saving" | "error">("idle");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  function toggleMed(med: Med) {
    setS((prev) => ({
      ...prev,
      habits: toggle(prev.habits, med.habit_key),
      meds: { ...prev.meds, [med.id]: !prev.meds[med.id] },
    }));
  }

  async function handleAddMed() {
    if (!newMedName.trim()) return;
    setAddMedStatus("saving");
    const res = await createMed(newMedName, newMedAsNeeded ? null : (newMedWhen || null), newMedAsNeeded);
    if (res.ok) {
      setNewMedName("");
      setNewMedWhen("");
      setNewMedAsNeeded(false);
      setAddingMed(false);
      setAddMedStatus("idle");
      router.refresh();
    } else {
      setAddMedStatus("error");
      setTimeout(() => setAddMedStatus("idle"), 2000);
    }
  }

  function handleDeleteMed(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    setConfirmDeleteId(null);
    startDelete(async () => {
      await deleteMed(id);
      router.refresh();
    });
  }

  async function save() {
    setStatus("saving");
    const res = await saveCheckin(dayKey, s);
    if (s.periodStart) {
      await savePeriodStart(dayKey);
    }
    if (res.ok) {
      setSavedWithPeriod(s.periodStart);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1800);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2800);
    }
  }

  const m = s.migraine;
  const medHabitKeys = new Set([...meds.map((med) => med.habit_key), ...SPORT_HABITS]);

  return (
    <div className="mt-5 space-y-5">
      {/* Date picker — navigate to ?date=YYYY-MM-DD on change */}
      <div>
        <span className={labelCls}>Дата</span>
        <input
          type="date"
          value={dayKey}
          max={todayISO}
          min="2026-01-01"
          onChange={(e) => {
            if (e.target.value) router.push(`/checkin?date=${e.target.value}`);
          }}
          className="mt-2 w-full rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-phase"
        />
        <button
          type="button"
          onClick={() => setS({ ...s, periodStart: !s.periodStart })}
          className="mt-2 flex items-center gap-2.5 text-left"
        >
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[3px] border-2 transition ${s.periodStart ? "border-phase bg-phase text-on-phase" : "border-line bg-surface text-transparent"}`}>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <span className={`font-mono text-[11px] tracking-[0.06em] transition ${s.periodStart ? "text-phase" : "text-ink-3"}`}>
            {s.periodStart ? "День 1 цикла · будет записан" : "Начало цикла"}
          </span>
        </button>
      </div>

      <div className="rounded-card border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium text-ink">Была мигрень сегодня?</span>
          <button
            type="button"
            role="switch"
            aria-checked={m.had}
            aria-label="Отметить мигрень"
            onClick={() => setS({ ...s, migraine: { ...m, had: !m.had } })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${m.had ? "bg-phase" : "bg-line"}`}
          >
            <span
              className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${m.had ? "left-[23px]" : "left-[3px]"}`}
            />
          </button>
        </div>

        {m.had && (
          <div className="mt-4 space-y-4">
            <div>
              <span className={labelCls}>Интенсивность</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={m.intensity}
                  onChange={(e) => setS({ ...s, migraine: { ...m, intensity: +e.target.value } })}
                  className="h-6 flex-1"
                  style={{ accentColor: "var(--phase)" }}
                />
                <span className="w-7 text-center font-mono text-[22px] font-semibold text-phase-deep">{m.intensity}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] text-ink">Аура</span>
              <button
                type="button"
                role="switch"
                aria-checked={m.aura}
                aria-label="Аура"
                onClick={() => setS({ ...s, migraine: { ...m, aura: !m.aura } })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${m.aura ? "bg-phase" : "bg-line"}`}
              >
                <span
                  className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${m.aura ? "left-[23px]" : "left-[3px]"}`}
                />
              </button>
            </div>

            <div>
              <span className={labelCls}>Триггеры</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {TRIGGERS.map((t) => {
                  const on = m.triggers.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setS({ ...s, migraine: { ...m, triggers: toggle(m.triggers, t) } })}
                      className={`${chipBase} ${
                        on ? "border-phase bg-phase-soft font-semibold text-phase-deep" : "border-line bg-surface text-ink-2"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <span className={labelCls}>Вес, кг</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={s.weight}
            placeholder={weightPlaceholder != null ? String(weightPlaceholder) : "кг"}
            onChange={(e) => setS({ ...s, weight: e.target.value })}
            className="mt-2 w-full rounded-[3px] border border-line bg-surface px-4 py-3 text-[17px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </div>
        <div className="flex-1">
          <span className={labelCls}>Ккал</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            value={s.kcal}
            placeholder="—"
            onChange={(e) => setS({ ...s, kcal: e.target.value })}
            className="mt-2 w-full rounded-[3px] border border-line bg-surface px-4 py-3 text-[17px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className={labelCls}>Приём препаратов</span>
          <div className="flex items-center gap-3">
            <Link href="/checkin/meds" className="font-mono text-[10px] text-ink-3 underline underline-offset-2">
              график →
            </Link>
            <button
              type="button"
              onClick={() => { setAddingMed((v) => !v); setNewMedName(""); setNewMedWhen(""); setNewMedAsNeeded(false); }}
              className="text-[11px] font-semibold text-phase-deep"
            >
              {addingMed ? "Отмена" : "+ Добавить"}
            </button>
          </div>
        </div>

        <div className="mt-2 rounded-card border border-line bg-surface px-4">
          {meds.map((med, i) => {
            const on = s.habits.includes(med.habit_key);
            const isConfirming = confirmDeleteId === med.id;
            return (
              <div
                key={med.id}
                className={`flex w-full items-center gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleMed(med)}
                  className="flex flex-1 items-center gap-3 text-left min-w-0"
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-[3px] border-2 transition ${on ? "border-phase bg-phase text-on-phase" : "border-ink-3 text-transparent"}`}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                  <span className={`text-[15px] leading-snug ${on ? "text-ink-3 line-through" : "text-ink"}`}>
                    {med.name}
                    {med.note && <span className="text-[12px] text-ink-3"> · {med.note}</span>}
                    {med.isAsNeeded
                      ? <span className="text-[11px] text-warn"> · по мигрени</span>
                      : med.when && <span className="text-[12px] text-ink-3"> · {med.when}</span>}
                  </span>
                </button>
                {isConfirming ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteMed(med.id)}
                      className="rounded-[2px] bg-red-600 px-2.5 py-1 font-mono text-[11px] text-white"
                    >
                      Да
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="font-mono text-[11px] text-ink-3"
                    >
                      Нет
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(med.id)}
                    className="shrink-0 pl-2 font-mono text-[16px] leading-none text-ink-4 transition active:text-ink-2"
                    aria-label="Удалить препарат"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {meds.length === 0 && (
            <p className="py-3 font-mono text-[12px] text-ink-4">Нет препаратов — добавь ниже</p>
          )}
        </div>

        {addingMed && (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={newMedName}
              onChange={(e) => setNewMedName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMed()}
              placeholder="Название препарата"
              autoFocus
              className="w-full rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
            />
            <div className="flex items-center gap-2">
              {!newMedAsNeeded && (
                <input
                  type="time"
                  value={newMedWhen}
                  onChange={(e) => setNewMedWhen(e.target.value)}
                  placeholder="Время"
                  className="flex-1 rounded-[3px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-phase"
                />
              )}
              <button
                type="button"
                onClick={() => setNewMedAsNeeded((v) => !v)}
                className={`shrink-0 rounded-[3px] border px-3 py-2 font-mono text-[11px] tracking-[0.06em] transition ${
                  newMedAsNeeded
                    ? "border-warn bg-warn/10 text-warn"
                    : "border-line text-ink-3"
                }`}
              >
                {newMedAsNeeded ? "по мигрени ✓" : "по мигрени"}
              </button>
              <button
                type="button"
                onClick={handleAddMed}
                disabled={!newMedName.trim() || addMedStatus === "saving"}
                className="shrink-0 rounded-[3px] bg-phase px-4 py-2 text-[14px] font-semibold text-on-phase disabled:opacity-50"
              >
                {addMedStatus === "saving" ? "…" : addMedStatus === "error" ? "!" : "OK"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <span className={labelCls}>Привычки</span>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {habits.filter((h) => !medHabitKeys.has(h)).map((h) => {
            const on = s.habits.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => setS({ ...s, habits: toggle(s.habits, h) })}
                className={`${chipBase} ${
                  on ? "border-phase bg-phase-soft font-semibold text-phase-deep" : "border-line bg-surface text-ink-2"
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={status === "saving"}
        className="w-full rounded-[3px] bg-phase py-4 text-[15px] font-semibold text-on-phase shadow-sm transition active:scale-[0.99] disabled:opacity-70"
      >
        {status === "saving"
          ? "Сохраняю…"
          : status === "saved"
            ? (savedWithPeriod ? "Сохранено ✓ · день 1" : "Сохранено ✓")
            : status === "error"
              ? "Ошибка — повторить"
              : "Сохранить день"}
      </button>
    </div>
  );
}
