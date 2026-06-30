"use client";
import { useState, useTransition } from "react";
import { WheelSvg } from "./wheel-svg";
import { saveAssessment, type Scores, type Assessment } from "./actions";

const SEGMENTS: { key: keyof Scores; label: string; desc: string }[] = [
  { key: "family",  label: "Семья и любовь",       desc: "Близкие отношения, партнёр, родные, тепло дома" },
  { key: "work",    label: "Работа и реализация",  desc: "Смысл, признание, карьера, реализация потенциала" },
  { key: "rest",    label: "Отдых и развлечения",  desc: "Время для себя, хобби, развлечения, восстановление" },
  { key: "health",  label: "Здоровье и красота",   desc: "Тело, питание, сон, внешность и самоощущение" },
  { key: "friends", label: "Дружба и общение",     desc: "Круг общения, близкие друзья, социальная жизнь" },
  { key: "money",   label: "Деньги и имущество",   desc: "Финансы, стабильность, собственность, достаток" },
  { key: "spirit",  label: "Духовность",           desc: "Смыслы, ценности, внутренний мир, опора на себя" },
  { key: "growth",  label: "Личностный рост",      desc: "Развитие, знания, навыки, кто ты через год" },
];

const DEFAULT_SCORES: Scores = {
  family: 5, work: 5, rest: 5, health: 5,
  friends: 5, money: 5, spirit: 5, growth: 5,
};

const RU_MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export function BalanceForm({ assessments }: { assessments: Assessment[] }) {
  const latest = assessments[0];
  const prev = assessments[1];

  const [editing, setEditing] = useState(!latest);
  const [scores, setScores] = useState<Scores>(latest?.scores ?? DEFAULT_SCORES);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const [viewingId, setViewingId] = useState<string | null>(null);

  const viewingAssessment = viewingId ? assessments.find(a => a.id === viewingId) : null;

  const displayScores = editing
    ? scores
    : viewingAssessment
      ? viewingAssessment.scores
      : (latest?.scores ?? DEFAULT_SCORES);

  const displayPrev = editing
    ? (latest ? latest.scores : undefined)
    : viewingAssessment
      ? undefined
      : prev?.scores;

  function setScore(key: keyof Scores, val: number) {
    setScores((s) => ({ ...s, [key]: Math.max(1, Math.min(10, val)) }));
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
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    });
  }

  function startEditing() {
    setScores(latest?.scores ?? DEFAULT_SCORES);
    setViewingId(null);
    setEditing(true);
  }

  const weak = SEGMENTS
    .map((s) => ({ ...s, v: displayScores[s.key] }))
    .filter((s) => s.v <= 4)
    .sort((a, b) => a.v - b.v)
    .slice(0, 2);

  return (
    <div>
      {/* Wheel */}
      <div className="flex justify-center mt-5">
        <WheelSvg scores={displayScores} prev={displayPrev} />
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
            {SEGMENTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="font-sans text-[11px] text-ink-2">{s.label}</span>
                <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--phase)" }}>
                  {viewingAssessment.scores[s.key]}/10
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
              <div key={s.key} className="flex items-center gap-2">
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
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            оцени каждую сферу от 1 до 10
          </p>
          {SEGMENTS.map((s) => (
            <div key={s.key} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-sans text-[14px] font-semibold text-ink">{s.label}</p>
                  <p className="mt-0.5 font-sans text-[11px] text-ink-3">{s.desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setScore(s.key, scores[s.key] - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-2 transition active:scale-90"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-mono text-[18px] font-semibold" style={{ color: "var(--phase)" }}>
                    {scores[s.key]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScore(s.key, scores[s.key] + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-2 transition active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={1} max={10} step={1}
                value={scores[s.key]}
                onChange={(e) => setScore(s.key, +e.target.value)}
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
              const avg = Math.round(
                Object.values(a.scores).reduce((s, v) => s + v, 0) / SEGMENTS.length
              );
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
