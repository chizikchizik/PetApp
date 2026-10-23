"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMed, deleteMed, changeMedDose } from "../checkin/actions";
import type { Med } from "@/lib/data";

const labelCls = "font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3";
const groupCls = "pb-1 pt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3";

// Препараты дня. По умолчанию только отметки; добавление, смена дозы и
// удаление (мягкое — история приёмов сохраняется) — в режиме «изменить».
export function MedsCard({
  meds,
  medCounts,
  takenKeys,
  onToggle,
}: {
  meds: Med[];
  medCounts: Record<string, number>;
  takenKeys: Set<string>;
  onToggle: (med: Med) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, startT] = useTransition();
  const [changingDoseId, setChangingDoseId] = useState<string | null>(null);
  const [doseName, setDoseName] = useState("");
  const [doseNote, setDoseNote] = useState("");
  const [doseStatus, setDoseStatus] = useState<"idle" | "saving" | "error">("idle");
  const [newName, setNewName] = useState("");
  const [newWhen, setNewWhen] = useState("");
  const [newAsNeeded, setNewAsNeeded] = useState(false);
  const [addStatus, setAddStatus] = useState<"idle" | "saving">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  // Регулярные и витамины видны всегда. «По мигрени» бывает 10+ после импорта
  // из MigreBot — показываем топ-3 по частоте за месяц и уже отмеченные.
  const regular = meds.filter((m) => !m.isAsNeeded && !m.isSupplement);
  const supplements = meds.filter((m) => !m.isAsNeeded && m.isSupplement);
  const asNeeded = meds.filter((m) => m.isAsNeeded).sort((a, b) => (medCounts[b.id] ?? 0) - (medCounts[a.id] ?? 0));
  const pinned = new Set(asNeeded.slice(0, 3).map((m) => m.id));
  for (const m of asNeeded) if (takenKeys.has(m.habit_key)) pinned.add(m.id);
  const topAsNeeded = asNeeded.filter((m) => pinned.has(m.id) || editing);
  const otherAsNeeded = editing ? [] : asNeeded.filter((m) => !pinned.has(m.id));

  async function handleAdd() {
    if (!newName.trim()) return;
    setAddStatus("saving");
    setAddError(null);
    const res = await createMed(newName, newAsNeeded ? null : newWhen || null, newAsNeeded);
    setAddStatus("idle");
    if (res.ok) {
      setNewName("");
      setNewWhen("");
      setNewAsNeeded(false);
      router.refresh();
    } else {
      setAddError(res.error ?? "Не удалось добавить");
    }
  }

  async function handleChangeDose() {
    if (!changingDoseId) return;
    setDoseStatus("saving");
    const res = await changeMedDose(changingDoseId, doseName, doseNote);
    if (res.ok) {
      setChangingDoseId(null);
      setDoseStatus("idle");
      router.refresh();
    } else {
      setDoseStatus("error");
    }
  }

  function handleDelete(id: string) {
    setConfirmDeleteId(null);
    startT(async () => {
      await deleteMed(id);
      router.refresh();
    });
  }

  function row(med: Med, i: number) {
    const on = takenKeys.has(med.habit_key);
    const count = medCounts[med.id] ?? 0;
    return (
      <div key={med.id} className={i > 0 ? "border-t border-line" : ""}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(med)}
            className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 py-2 text-left"
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-[3px] border-2 transition ${on ? "border-phase bg-phase text-on-phase" : "border-ink-3 text-transparent"}`}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <span className="min-w-0 text-[15px] leading-snug text-ink">
              {med.name}
              {med.note && <span className="text-[12px] text-ink-2"> · {med.note}</span>}
              {med.isAsNeeded
                ? count > 0 && <span className="text-[12px] text-ink-2"> · {count} раз/мес</span>
                : med.when && <span className="text-[12px] text-ink-2"> · {med.when}</span>}
            </span>
          </button>
          {editing && (
            confirmDeleteId === med.id ? (
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => handleDelete(med.id)} className="min-h-[36px] rounded-[3px] bg-warn px-3 font-mono text-[12px] text-white">
                  Убрать
                </button>
                <button type="button" onClick={() => setConfirmDeleteId(null)} className="min-h-[36px] px-2 font-mono text-[12px] text-ink-2">
                  Нет
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (changingDoseId === med.id) { setChangingDoseId(null); return; }
                    setChangingDoseId(med.id);
                    setDoseName(med.name);
                    setDoseNote(med.note);
                    setDoseStatus("idle");
                  }}
                  className="min-h-[40px] px-2 font-mono text-[12px] text-ink-2 underline underline-offset-2"
                >
                  доза
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(med.id)}
                  aria-label={`Убрать ${med.name} из списка`}
                  className="grid h-10 w-10 place-items-center font-mono text-[18px] leading-none text-ink-3"
                >
                  ×
                </button>
              </div>
            )
          )}
        </div>
        {editing && confirmDeleteId === med.id && (
          <p className="pb-2 font-sans text-[12px] text-ink-2">Препарат пропадёт из списка, история приёмов останется.</p>
        )}
        {editing && changingDoseId === med.id && (
          <div className="mb-3 space-y-2 rounded-[3px] border border-line bg-surface-2 p-3">
            <p className="font-sans text-[12px] text-ink-2">Новая доза или название. Старая запись останется в истории.</p>
            <input
              id={`dose-name-${med.id}`}
              type="text"
              value={doseName}
              onChange={(e) => setDoseName(e.target.value)}
              placeholder="Название"
              className="min-h-[44px] w-full rounded-[3px] border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-phase"
            />
            <input
              id={`dose-note-${med.id}`}
              type="text"
              value={doseNote}
              onChange={(e) => setDoseNote(e.target.value)}
              placeholder="Доза, мг"
              className="min-h-[44px] w-full rounded-[3px] border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-phase"
            />
            <button
              type="button"
              onClick={handleChangeDose}
              disabled={doseStatus === "saving"}
              className="min-h-[44px] w-full rounded-[3px] bg-phase font-mono text-[12px] font-semibold text-on-phase disabled:opacity-60"
            >
              {doseStatus === "saving" ? "Сохраняю…" : doseStatus === "error" ? "Не сохранилось — ещё раз" : "Сохранить как новую дозу"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <span className={labelCls}>Препараты</span>
        <div className="flex items-center gap-1">
          <Link href="/checkin/meds" className="flex min-h-[36px] items-center px-2 font-mono text-[11px] text-ink-2 underline underline-offset-2">
            график
          </Link>
          <button
            type="button"
            onClick={() => { setEditing((v) => !v); setConfirmDeleteId(null); setChangingDoseId(null); }}
            className="min-h-[36px] px-2 font-mono text-[11px] font-semibold text-phase-deep"
          >
            {editing ? "готово" : "изменить список"}
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-card border border-line bg-surface px-4">
        {meds.length === 0 && (
          <p className="py-4 font-sans text-[13px] text-ink-2">
            Препаратов пока нет. Нажми «изменить список», чтобы добавить.
          </p>
        )}
        {regular.length > 0 && <p className={groupCls}>регулярные</p>}
        {regular.map(row)}
        {supplements.length > 0 && <p className={`${groupCls} ${regular.length ? "border-t border-line" : ""}`}>витамины</p>}
        {supplements.map(row)}
        {topAsNeeded.length > 0 && <p className={`${groupCls} ${regular.length + supplements.length ? "border-t border-line" : ""}`}>по мигрени и боли</p>}
        {topAsNeeded.map(row)}
        {otherAsNeeded.length > 0 && (
          <div className="border-t border-line">
            <button
              type="button"
              onClick={() => setShowOther((v) => !v)}
              className="min-h-[44px] font-mono text-[12px] text-ink-2 underline underline-offset-2"
            >
              {showOther ? "скрыть" : `другие (${otherAsNeeded.length})`}
            </button>
            {showOther && otherAsNeeded.map(row)}
          </div>
        )}

        {editing && (
          <div className="space-y-2 border-t border-line py-3">
            <input
              id="new-med-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Новый препарат"
              className="min-h-[44px] w-full rounded-[3px] border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
            />
            <div className="flex items-center gap-2">
              {!newAsNeeded && (
                <input
                  id="new-med-when"
                  type="time"
                  value={newWhen}
                  onChange={(e) => setNewWhen(e.target.value)}
                  aria-label="Время приёма"
                  className="min-h-[44px] flex-1 rounded-[3px] border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-phase"
                />
              )}
              <button
                type="button"
                aria-pressed={newAsNeeded}
                onClick={() => setNewAsNeeded((v) => !v)}
                className={`min-h-[44px] shrink-0 rounded-[3px] border px-3 font-mono text-[12px] transition ${newAsNeeded ? "border-warn bg-warn-soft text-warn" : "border-line text-ink-2"}`}
              >
                {newAsNeeded ? "по мигрени ✓" : "по мигрени"}
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newName.trim() || addStatus === "saving"}
                className="min-h-[44px] shrink-0 rounded-[3px] bg-phase px-4 text-[14px] font-semibold text-on-phase disabled:opacity-50"
              >
                {addStatus === "saving" ? "…" : "Добавить"}
              </button>
            </div>
            {addError && <p className="font-mono text-[11px] text-warn">{addError}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
