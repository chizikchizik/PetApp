"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHabit, stopHabit, resumeHabit, archiveHabit, removeFromMonth, moveStartToMonth, deleteHabit } from "./actions";
import { createMed, deleteMed } from "../checkin/actions";
import type { HabitRow, Med } from "@/lib/data";

const RU_MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${RU_MONTHS[m - 1]} ${y}`;
}

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

type Section = "active" | "stopped" | "archived" | "notyet";

function classify(h: HabitRow, month: string): Section {
  if (!h.active) return "archived";
  if (h.started_month && h.started_month > month) return "notyet";
  if (h.ended_month && h.ended_month < month) return "stopped";
  return "active";
}

export function HabitManager({
  habits,
  meds = [],
  currentMonth,
  viewedMonth,
}: {
  habits: HabitRow[];
  meds?: Med[];
  currentMonth: string;
  viewedMonth?: string;
}) {
  const router = useRouter();
  const targetMonth = viewedMonth ?? currentMonth;
  const [itemType, setItemType] = useState<"habit" | "med">("habit");
  const [newName, setNewName] = useState("");
  const [newStartMonth, setNewStartMonth] = useState(targetMonth);
  const [medWhen, setMedWhen] = useState("");
  const [medAsNeeded, setMedAsNeeded] = useState(false);
  const [addError, setAddError] = useState("");
  const [confirmArchive, setConfirmArchive] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteMed, setConfirmDeleteMed] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync default start month when navigating between months
  useEffect(() => { setNewStartMonth(targetMonth); }, [targetMonth]);

  const active  = habits.filter((h) => classify(h, targetMonth) === "active");
  const stopped = habits.filter((h) => classify(h, targetMonth) === "stopped");
  const notyet  = habits.filter((h) => classify(h, targetMonth) === "notyet");
  const archived = habits.filter((h) => classify(h, targetMonth) === "archived");

  function add() {
    setAddError("");
    const trimmed = newName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      if (itemType === "med") {
        const res = await createMed(trimmed, medWhen, medAsNeeded);
        if (res.ok) {
          setNewName("");
          setMedWhen("");
          setMedAsNeeded(false);
          router.refresh();
        } else {
          setAddError(res.error ?? "Ошибка");
        }
        return;
      }
      const res = await createHabit(trimmed, newStartMonth);
      if (res.ok) {
        setNewName("");
        setNewStartMonth(targetMonth);
      } else {
        setAddError(res.error ?? "Ошибка");
      }
    });
  }

  function removeMed(id: string) {
    startTransition(async () => {
      await deleteMed(id);
      setConfirmDeleteMed(null);
      router.refresh();
    });
  }

  const labelCls = "text-[10px] font-mono tracking-[0.12em] uppercase text-ink-3 font-semibold";
  const rowCls = "flex items-center justify-between gap-3 py-2.5 px-3.5";
  const nameCls = "text-[14px] text-ink flex-1 min-w-0 truncate";
  const btnCls = "shrink-0 text-[11px] font-mono tracking-[0.06em] transition";

  return (
    <div className="mt-5">
        <div className="space-y-4 rounded-card border border-line bg-surface p-4">

          {/* ── Добавить ── */}
          <div>
            <p className={labelCls}>Добавить</p>
            <div className="mt-2 flex gap-1.5">
              {(["habit", "med"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setItemType(t); setAddError(""); }}
                  className={`flex-1 rounded-[3px] border py-2 font-mono text-[10px] tracking-[0.06em] uppercase transition ${
                    itemType === t
                      ? "border-phase bg-phase-soft text-phase-deep font-semibold"
                      : "border-line text-ink-3"
                  }`}
                >
                  {t === "habit" ? "Привычка" : "Препарат (назначение)"}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder={itemType === "med" ? "Название препарата" : "Название"}
                className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
              />
              <button
                type="button"
                onClick={add}
                disabled={isPending || !newName.trim()}
                className="rounded-[3px] bg-phase px-4 py-2.5 text-[14px] font-semibold text-on-phase disabled:opacity-50"
              >
                +
              </button>
            </div>
            {itemType === "habit" ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-ink-3">начать с</span>
                <input
                  type="month"
                  value={newStartMonth}
                  max={nextMonth(currentMonth)}
                  onChange={(e) => setNewStartMonth(e.target.value || currentMonth)}
                  className="rounded-[3px] border border-line bg-surface px-2 py-1 font-mono text-[12px] text-ink outline-none focus:border-phase"
                />
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                {!medAsNeeded && (
                  <input
                    type="time"
                    value={medWhen}
                    onChange={(e) => setMedWhen(e.target.value)}
                    placeholder="Время"
                    className="flex-1 rounded-[3px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-phase"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setMedAsNeeded((v) => !v)}
                  className={`shrink-0 rounded-[3px] border px-3 py-2 font-mono text-[11px] tracking-[0.06em] transition ${
                    medAsNeeded ? "border-warn bg-warn/10 text-warn" : "border-line text-ink-3"
                  }`}
                >
                  {medAsNeeded ? "по мигрени ✓" : "по мигрени"}
                </button>
              </div>
            )}
            {itemType === "med" && (
              <p className="mt-1.5 font-mono text-[9px] text-ink-4">
                Появится в приёме препаратов на чек-ине
              </p>
            )}
            {addError && <p className="mt-1.5 font-sans text-[12px] text-warn">{addError}</p>}
          </div>

          {/* ── Препараты ── */}
          {meds.length > 0 && (
            <div>
              <p className={labelCls}>Препараты</p>
              <div className="mt-2 divide-y divide-line rounded-card border border-line">
                {meds.map((med) => (
                  <div key={med.id} className={rowCls}>
                    <div className="min-w-0 flex-1">
                      <span className={nameCls}>{med.name}</span>
                      {(med.isAsNeeded || med.when) && (
                        <span className="ml-1.5 font-mono text-[10px] text-ink-3">
                          {med.isAsNeeded ? "по мигрени" : med.when}
                        </span>
                      )}
                    </div>
                    {confirmDeleteMed === med.id ? (
                      <div className="flex shrink-0 items-center gap-3">
                        <button type="button" onClick={() => removeMed(med.id)} disabled={isPending} className={`${btnCls} text-warn`}>
                          Удалить
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteMed(null)} className={`${btnCls} text-ink-3`}>Отмена</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMed(med.id)}
                        className={`${btnCls} text-ink-4 hover:text-warn`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[9px] text-ink-4">
                Управление дозой — на чек-ине
              </p>
            </div>
          )}

          {/* ── Активные ── */}
          {active.length > 0 && (
            <div>
              <p className={labelCls}>Активные в {monthLabel(targetMonth)}</p>
              <div className="mt-2 divide-y divide-line rounded-card border border-line">
                {active.map((h) => (
                  <div key={h.id} className={rowCls}>
                    <span className={nameCls}>{h.name}</span>
                    <div className="flex items-center gap-3">
                      {confirmDelete === h.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                await deleteHabit(h.id);
                                setConfirmDelete(null);
                              })
                            }
                            disabled={isPending}
                            className={`${btnCls} text-warn`}
                          >
                            Удалить
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className={`${btnCls} text-ink-3`}>Отмена</button>
                        </>
                      ) : confirmArchive === h.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                await removeFromMonth(h.id, targetMonth);
                                setConfirmArchive(null);
                              })
                            }
                            disabled={isPending}
                            className={`${btnCls} text-warn`}
                          >
                            Убрать
                          </button>
                          <button type="button" onClick={() => setConfirmArchive(null)} className={`${btnCls} text-ink-3`}>Отмена</button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startTransition(async () => { await stopHabit(h.id, targetMonth); })}
                            disabled={isPending}
                            title={`Последний месяц: ${monthLabel(targetMonth)}`}
                            className={`${btnCls} text-ink-3 hover:text-ink-2`}
                          >
                            Прекратить
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmDelete(null); setConfirmArchive(h.id); }}
                            title={`Убрать из ${monthLabel(targetMonth)} и всех следующих`}
                            className={`${btnCls} text-ink-4 hover:text-warn`}
                          >
                            Убрать
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmArchive(null); setConfirmDelete(h.id); }}
                            title="Удалить привычку насовсем"
                            className={`${btnCls} text-ink-4 hover:text-warn`}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[9px] text-ink-4">
                «Прекратить» — скроется со следующего месяца · «Убрать» — убирает из этого · «×» — удалить насовсем
              </p>
            </div>
          )}

          {/* ── Ещё не начаты в этом месяце ── */}
          {notyet.length > 0 && (
            <div>
              <p className={labelCls}>Начнутся позже</p>
              <div className="mt-2 divide-y divide-line rounded-card border border-line opacity-50">
                {notyet.map((h) => (
                  <div key={h.id} className={rowCls}>
                    <div className="min-w-0 flex-1">
                      <span className={nameCls}>{h.name}</span>
                      {h.started_month && (
                        <span className="ml-1.5 font-mono text-[10px] text-ink-3">
                          с {monthLabel(h.started_month)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startTransition(async () => { await moveStartToMonth(h.id, targetMonth); })}
                        disabled={isPending}
                        title={`Сдвинуть старт на ${monthLabel(targetMonth)}`}
                        className={`${btnCls} text-phase-deep`}
                      >
                        Добавить сюда
                      </button>
                      {confirmDelete === h.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startTransition(async () => { await deleteHabit(h.id); setConfirmDelete(null); })}
                            disabled={isPending}
                            className={`${btnCls} text-warn`}
                          >
                            Удалить
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className={`${btnCls} text-ink-3`}>Отмена</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(h.id)}
                          className={`${btnCls} text-ink-4 hover:text-warn`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Остановленные ── */}
          {stopped.length > 0 && (
            <div>
              <p className={labelCls}>Остановленные</p>
              <div className="mt-2 divide-y divide-line rounded-card border border-line opacity-70">
                {stopped.map((h) => (
                  <div key={h.id} className={rowCls}>
                    <div className="min-w-0 flex-1">
                      <span className={`${nameCls} line-through`}>{h.name}</span>
                      {h.ended_month && (
                        <span className="ml-1.5 font-mono text-[10px] text-ink-3">
                          до {monthLabel(h.ended_month)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startTransition(async () => { await resumeHabit(h.id, currentMonth); })}
                        disabled={isPending}
                        className={`${btnCls} text-phase-deep`}
                      >
                        Возобновить
                      </button>
                      {confirmDelete === h.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startTransition(async () => { await deleteHabit(h.id); setConfirmDelete(null); })}
                            disabled={isPending}
                            className={`${btnCls} text-warn`}
                          >
                            Удалить
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className={`${btnCls} text-ink-3`}>Отмена</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(h.id)}
                          className={`${btnCls} text-ink-4 hover:text-warn`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Архив ── */}
          {archived.length > 0 && (
            <div>
              <p className={labelCls}>Архив</p>
              <div className="mt-2 divide-y divide-line rounded-card border border-line opacity-60">
                {archived.map((h) => (
                  <div key={h.id} className={rowCls}>
                    <span className={`${nameCls} line-through`}>{h.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startTransition(async () => { await resumeHabit(h.id, currentMonth); })}
                        disabled={isPending}
                        className={`${btnCls} text-phase-deep`}
                      >
                        Начать снова
                      </button>
                      {confirmDelete === h.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startTransition(async () => { await deleteHabit(h.id); setConfirmDelete(null); })}
                            disabled={isPending}
                            className={`${btnCls} text-warn`}
                          >
                            Удалить
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className={`${btnCls} text-ink-3`}>Отмена</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(h.id)}
                          className={`${btnCls} text-ink-4 hover:text-warn`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
