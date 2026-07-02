"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WheelSvg } from "./wheel-svg";
import {
  saveAssessment,
  addSector,
  renameSector,
  deleteSector,
  type Sector,
  type ScoreMap,
  type Assessment,
} from "./actions";

const RU_MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function defaultScores(sectors: Sector[]): ScoreMap {
  return Object.fromEntries(sectors.map((s) => [s.id, 5]));
}

export function BalanceForm({ sectors, assessments }: { sectors: Sector[]; assessments: Assessment[] }) {
  const router = useRouter();
  const latest = assessments[0];
  const prev = assessments[1];

  const [editing, setEditing] = useState(!latest);
  const [scores, setScores] = useState<ScoreMap>(latest?.scores ?? defaultScores(sectors));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [managingSectors, setManagingSectors] = useState(false);
  const [renameDrafts, setRenameDrafts] = useState<Record<number, string>>({});
  const [newSectorLabel, setNewSectorLabel] = useState("");
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [sectorBusy, setSectorBusy] = useState(false);

  const viewingAssessment = viewingId ? assessments.find(a => a.id === viewingId) : null;

  const displayScores = editing
    ? scores
    : viewingAssessment
      ? viewingAssessment.scores
      : (latest?.scores ?? defaultScores(sectors));

  const displayPrev = editing
    ? (latest ? latest.scores : undefined)
    : viewingAssessment
      ? undefined
      : prev?.scores;

  function setScore(id: number, val: number) {
    setScores((s) => ({ ...s, [id]: Math.max(1, Math.min(10, val)) }));
  }

  function handleSave() {
    setStatus("saving");
    startTransition(async () => {
      const res = await saveAssessment(scores, note);
      if (res.ok) {
        setStatus("saved");
        setEditing(false);
        setViewingId(null);
        setNote("");
        setTimeout(() => setStatus("idle"), 2000);
        router.refresh();
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    });
  }

  function startEditing() {
    setScores(latest?.scores ?? defaultScores(sectors));
    setViewingId(null);
    setEditing(true);
  }

  async function handleRenameSector(id: number) {
    const label = renameDrafts[id];
    if (label == null) return;
    setSectorBusy(true);
    setSectorError(null);
    const res = await renameSector(id, label);
    if (!res.ok) setSectorError("Не удалось переименовать");
    setSectorBusy(false);
    router.refresh();
  }

  async function handleDeleteSector(id: number) {
    setSectorBusy(true);
    setSectorError(null);
    const res = await deleteSector(id);
    if (!res.ok) setSectorError(res.error ?? "Не удалось удалить");
    setSectorBusy(false);
    router.refresh();
  }

  async function handleAddSector() {
    const label = newSectorLabel.trim();
    if (!label) return;
    setSectorBusy(true);
    setSectorError(null);
    const res = await addSector(label);
    if (!res.ok) setSectorError("Не удалось добавить");
    else setNewSectorLabel("");
    setSectorBusy(false);
    router.refresh();
  }

  const weak = sectors
    .map((s) => ({ ...s, v: displayScores[s.id] }))
    .filter((s) => s.v != null && s.v <= 4)
    .sort((a, b) => (a.v ?? 0) - (b.v ?? 0))
    .slice(0, 2);

  return (
    <div>
      {/* Wheel */}
      <div className="flex justify-center mt-5">
        <WheelSvg sectors={sectors} scores={displayScores} prev={displayPrev} />
      </div>

      {/* Date label */}
      {!editing && (
        <p className="mt-2 text-center font-mono text-[10px] text-ink-3">
          {viewingAssessment
            ? `оценка · ${fmtDateTime(viewingAssessment.created_at)}`
            : latest
              ? `последняя оценка · ${fmtDate(latest.assessed_at)}`
              : null}
        </p>
      )}

      {/* Viewing historical — scores breakdown */}
      {!editing && viewingAssessment && (
        <div className="mt-3 rounded-card border border-line bg-surface p-3.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {sectors.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="font-sans text-[11px] text-ink-2">{s.label}</span>
                <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--phase)" }}>
                  {viewingAssessment.scores[s.id] != null ? `${viewingAssessment.scores[s.id]}/10` : "—"}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setViewingId(null)}
            className="mt-3 w-full text-center font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3"
          >
            ← текущая оценка
          </button>
        </div>
      )}

      {/* Weak zones callout — only when viewing current */}
      {!editing && !viewingAssessment && weak.length > 0 && (
        <div
          className="mt-4 rounded-card border p-3.5"
          style={{ borderColor: "var(--phase)", borderLeft: "3px solid var(--phase)" }}
        >
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-phase">
            фокус зоны
          </p>
          <div className="mt-1.5 space-y-1">
            {weak.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-phase-deep">{s.v}/10</span>
                <span className="font-sans text-[13px] text-ink">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-sans text-[11.5px] text-ink-3 leading-relaxed">
            Эти сферы — твоя точка роста. Небольшое улучшение здесь даст ощутимый результат.
          </p>
        </div>
      )}

      {/* Edit / New assessment button */}
      {!editing && !viewingAssessment && (
        <button
          type="button"
          onClick={startEditing}
          className="mt-4 w-full rounded-card border border-phase py-3 font-sans text-[14px] font-semibold text-phase-deep transition active:scale-[0.99]"
        >
          {latest ? "Обновить оценку" : "Оценить себя"}
        </button>
      )}

      {/* Editing form */}
      {editing && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
              оцени каждую сферу от 1 до 10
            </p>
            <button
              type="button"
              onClick={() => { setManagingSectors((v) => !v); setSectorError(null); }}
              className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3 underline"
            >
              {managingSectors ? "готово" : "настроить сферы"}
            </button>
          </div>

          {managingSectors && (
            <div className="rounded-card border border-line bg-surface p-3.5 space-y-2.5">
              {sectors.map((s, i) => (
                // Keyed by position, not s.id: the very first edit on a fresh user
                // materializes synthetic ids (0..7) into real DB ids, which would
                // otherwise remount every row (and drop any in-progress typing in
                // a field the user hasn't blurred yet) right after router.refresh().
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={s.label}
                    onChange={(e) => setRenameDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                    onBlur={() => {
                      if (renameDrafts[s.id] != null && renameDrafts[s.id] !== s.label) handleRenameSector(s.id);
                    }}
                    disabled={sectorBusy}
                    className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-3 py-2 font-sans text-[13px] text-ink outline-none focus:border-phase"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteSector(s.id)}
                    disabled={sectorBusy}
                    className="shrink-0 font-mono text-[11px] text-ink-4 transition hover:text-red-500 disabled:opacity-40"
                  >
                    удалить
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newSectorLabel}
                  onChange={(e) => setNewSectorLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSector()}
                  placeholder="Новая сфера..."
                  disabled={sectorBusy}
                  className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-3 py-2 font-sans text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
                />
                <button
                  type="button"
                  onClick={handleAddSector}
                  disabled={sectorBusy || !newSectorLabel.trim()}
                  className="shrink-0 rounded-[3px] border border-line bg-surface px-4 font-mono text-[13px] text-phase disabled:opacity-40"
                >
                  +
                </button>
              </div>
              {sectorError && (
                <p className="font-mono text-[11px] text-red-400">{sectorError}</p>
              )}
            </div>
          )}

          {sectors.map((s) => (
            <div key={s.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-sans text-[14px] font-semibold text-ink">{s.label}</p>
                  {s.description && (
                    <p className="mt-0.5 font-sans text-[11px] text-ink-3">{s.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setScore(s.id, (scores[s.id] ?? 5) - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-2 transition active:scale-90"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-mono text-[18px] font-semibold" style={{ color: "var(--phase)" }}>
                    {scores[s.id] ?? 5}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScore(s.id, (scores[s.id] ?? 5) + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-2 transition active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={1} max={10} step={1}
                value={scores[s.id] ?? 5}
                onChange={(e) => setScore(s.id, +e.target.value)}
                className="mt-3 w-full h-5"
                style={{ accentColor: "var(--phase)" }}
              />
            </div>
          ))}

          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Что заметила? Что хочешь изменить?…"
              rows={2}
              className="w-full resize-none rounded-[3px] border border-line bg-surface px-4 py-3 font-sans text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
            />
          </div>

          <div className="flex gap-2">
            {latest && (
              <button
                type="button"
                onClick={() => { setEditing(false); setScores(latest.scores); }}
                className="flex-1 rounded-[3px] border border-line py-3.5 font-sans text-[14px] text-ink-2 transition"
              >
                Отмена
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || status === "saving"}
              className="flex-1 rounded-[3px] bg-phase py-3.5 font-sans text-[14px] font-semibold text-on-phase transition active:scale-[0.99] disabled:opacity-60"
            >
              {status === "saving" ? "Сохраняю…" : status === "saved" ? "Сохранено ✓" : status === "error" ? "Ошибка" : "Сохранить"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {assessments.length > 1 && !editing && (
        <div className="mt-6">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">история</p>
          <div className="mt-2 space-y-2">
            {assessments.slice(1).map((a) => {
              const vals = Object.values(a.scores);
              const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
              const isViewing = viewingId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setViewingId(isViewing ? null : a.id)}
                  className="flex w-full items-center gap-3 rounded-card border bg-surface px-3.5 py-3 text-left transition active:scale-[0.99]"
                  style={{
                    borderColor: isViewing ? "var(--phase)" : undefined,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-ink-2">{fmtDateTime(a.created_at)}</p>
                    {a.note && (
                      <p className="mt-0.5 font-sans text-[12px] text-ink-3 truncate">{a.note}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-mono text-[15px] font-semibold" style={{ color: isViewing ? "var(--phase)" : undefined }}>
                      {avg}/10
                    </span>
                    <p className="font-mono text-[8px] text-ink-4">средний</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
