"use client";
import { useState, useTransition } from "react";
import { deleteWorkout, updateWorkout, bulkDeleteWorkouts } from "./actions";
import type { WorkoutRow } from "./actions";
import { isoLocal } from "@/lib/format";

const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function fatigueLabel(pct: number): string {
  if (pct <= 30) return "лёгкая";
  if (pct <= 60) return "рабочая";
  if (pct <= 80) return "высокая";
  return "предел";
}

const FIELD = "h-8 w-full rounded-[3px] border border-line bg-surface-3 px-2 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-[var(--phase)]";
const LABEL = "font-mono text-[9px] tracking-[0.12em] uppercase text-ink-3";

type EditState = {
  type: string;
  workout_date: string;
  duration: string;
  fatigue: number;
  note: string;
};

const PAGE_SIZE = 30;

export function WorkoutHistoryList({ workouts }: { workouts: WorkoutRow[] }) {
  const [items, setItems] = useState(workouts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ type: "", workout_date: "", duration: "", fatigue: 50, note: "" });
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const visible = showAll ? items : items.slice(0, PAGE_SIZE);
  const hidden = items.length - PAGE_SIZE;

  // ── helpers ──────────────────────────────────────────────────────────
  function openEdit(w: WorkoutRow) {
    setConfirmId(null);
    setEditingId(w.id);
    setEdit({
      type: w.type,
      workout_date: w.workout_date,
      duration: w.duration_min?.toString() ?? "",
      fatigue: w.fatigue_pct ?? 50,
      note: w.note ?? "",
    });
  }

  function saveEdit(id: string) {
    const dur = edit.duration ? parseInt(edit.duration) || null : null;
    startTransition(async () => {
      const res = await updateWorkout(id, {
        type: edit.type,
        workout_date: edit.workout_date,
        duration: dur,
        fatigue_pct: edit.fatigue,
        note: edit.note,
      });
      if (res.ok) {
        setItems(prev => prev.map(w => w.id === id
          ? { ...w, type: edit.type, workout_date: edit.workout_date, duration_min: dur, fatigue_pct: edit.fatigue, note: edit.note || null }
          : w
        ).sort((a, b) => b.workout_date.localeCompare(a.workout_date)));
        setEditingId(null);
      }
    });
  }

  function doDeleteOne(id: string) {
    startTransition(async () => {
      const res = await deleteWorkout(id);
      if (res.ok) {
        setItems(prev => prev.filter(w => w.id !== id));
        setConfirmId(null);
      }
    });
  }

  function doBulkDelete() {
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkDeleteWorkouts(ids);
      if (res.ok) {
        setItems(prev => prev.filter(w => !selected.has(w.id)));
        setSelected(new Set());
        setBulkMode(false);
      }
    });
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(selected.size === visible.length ? new Set() : new Set(visible.map(w => w.id)));
  }

  // ── render ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header row */}
      <div className="mt-5 flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          история · нагрузка · {items.length}
        </p>
        <button
          onClick={() => {
            if (bulkMode) { setBulkMode(false); setSelected(new Set()); }
            else { setBulkMode(true); setEditingId(null); setConfirmId(null); }
          }}
          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-3 underline underline-offset-2"
        >
          {bulkMode ? "отмена" : "выбрать"}
        </button>
      </div>

      {bulkMode && (
        <button
          onClick={toggleSelectAll}
          className="mt-1.5 font-mono text-[10px] text-ink-3 underline underline-offset-2"
        >
          {selected.size === visible.length ? "снять всё" : "выбрать всё"}
        </button>
      )}

      <div className="mt-2 space-y-2">
        {visible.map(w => (
          <div
            key={w.id}
            className={`rounded-card border bg-surface p-4 transition-colors ${
              bulkMode && selected.has(w.id) ? "border-[var(--phase)]" : "border-line"
            }`}
          >
            {editingId === w.id ? (
              /* ── Edit form ─────────────────────── */
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className={LABEL}>Тип тренировки</div>
                    <input
                      className={`mt-1 ${FIELD}`}
                      value={edit.type}
                      onChange={e => setEdit(s => ({ ...s, type: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="shrink-0">
                    <div className={LABEL}>Дата</div>
                    <input
                      type="date"
                      className={`mt-1 ${FIELD} w-[136px]`}
                      value={edit.workout_date}
                      max={isoLocal(new Date())}
                      onChange={e => setEdit(s => ({ ...s, workout_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className={LABEL}>Длительность, мин</div>
                    <input
                      type="number"
                      min={1}
                      className={`mt-1 ${FIELD}`}
                      value={edit.duration}
                      onChange={e => setEdit(s => ({ ...s, duration: e.target.value }))}
                      placeholder="—"
                    />
                  </div>
                  <div className="flex-1">
                    <div className={LABEL}>Усилие · {edit.fatigue}%</div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={edit.fatigue}
                      onChange={e => setEdit(s => ({ ...s, fatigue: Number(e.target.value) }))}
                      className="mt-2.5 w-full"
                      style={{ accentColor: "var(--phase)" }}
                    />
                  </div>
                </div>
                <div>
                  <div className={LABEL}>Заметка</div>
                  <input
                    className={`mt-1 ${FIELD}`}
                    value={edit.note}
                    onChange={e => setEdit(s => ({ ...s, note: e.target.value }))}
                    placeholder="—"
                  />
                </div>
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={() => saveEdit(w.id)}
                    disabled={isPending || !edit.type.trim() || !edit.workout_date}
                    className="flex-1 rounded-[3px] py-1.5 font-mono text-[11px] font-semibold text-[var(--on-phase)] disabled:opacity-40"
                    style={{ background: "var(--phase)" }}
                  >
                    {isPending ? "…" : "Сохранить"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-[3px] border border-line px-5 py-1.5 font-mono text-[11px] text-ink-2"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal view ───────────────────── */
              <>
                <div className="flex items-start gap-2">
                  {/* Checkbox (bulk mode) */}
                  {bulkMode && (
                    <button
                      onClick={() => toggleSelect(w.id)}
                      className="mt-0.5 shrink-0"
                      aria-label={selected.has(w.id) ? "Снять выбор" : "Выбрать"}
                    >
                      <div
                        className="flex h-4 w-4 items-center justify-center rounded-[2px] border transition-colors"
                        style={selected.has(w.id)
                          ? { background: "var(--phase)", borderColor: "var(--phase)" }
                          : { borderColor: "var(--line)" }
                        }
                      >
                        {selected.has(w.id) && (
                          <svg viewBox="0 0 10 8" width="9" height="7" fill="none">
                            <polyline points="1,4 3.5,7 9,1" stroke="var(--on-phase)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )}

                  {/* Title */}
                  <div className="min-w-0 flex-1 font-sans font-semibold text-[14.5px] leading-snug text-ink">
                    {w.type}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="font-mono text-[10px] text-ink-3">{formatDate(w.workout_date)}</span>
                    {!bulkMode && (
                      <>
                        <button
                          onClick={() => openEdit(w)}
                          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-3 underline underline-offset-2"
                        >
                          ред.
                        </button>
                        {confirmId === w.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => doDeleteOne(w.id)}
                              disabled={isPending}
                              className="font-mono text-[10px] tracking-[0.08em] uppercase text-warn disabled:opacity-50"
                            >
                              {isPending ? "…" : "да"}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-3"
                            >
                              нет
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(w.id)}
                            className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-4 transition hover:text-warn"
                          >
                            удалить
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Fatigue bar */}
                {w.fatigue_pct != null && (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className="h-[5px] flex-1 overflow-hidden rounded-[1px] bg-surface-3">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${w.fatigue_pct}%`, background: "var(--phase)" }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-ink-2">
                      {w.fatigue_pct}% · {fatigueLabel(w.fatigue_pct)}
                    </span>
                  </div>
                )}

                {/* Duration / note */}
                {(w.duration_min || w.note) && (
                  <div className="mt-1.5 font-mono text-[10px] text-ink-3">
                    {[w.duration_min ? `${w.duration_min} мин` : null, w.note || null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Show more / less */}
      {items.length > PAGE_SIZE && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 w-full py-2.5 font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3 underline underline-offset-2"
        >
          {showAll ? "скрыть" : `показать все · ещё ${hidden}`}
        </button>
      )}

      {/* Bulk action bar — fixed above bottom nav */}
      {bulkMode && (
        <div className="fixed bottom-28 left-0 right-0 z-20 mx-auto max-w-[430px] px-5">
          <div className="rounded-card border border-line bg-surface p-3 shadow-lg flex items-center gap-3">
            <span className="flex-1 font-mono text-[11px] text-ink-2">
              Выбрано: <strong className="text-ink">{selected.size}</strong>
            </span>
            {selected.size > 0 && (
              <button
                onClick={doBulkDelete}
                disabled={isPending}
                className="rounded-[3px] border border-warn px-4 py-1.5 font-mono text-[11px] text-warn transition active:bg-warn active:text-white disabled:opacity-40"
              >
                {isPending ? "…" : `Удалить (${selected.size})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
