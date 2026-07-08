"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWeight } from "./actions";
import type { WeightRow } from "@/lib/data";

const RU_MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

function HistoryRow({ date, actual }: { date: string; actual: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(actual));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startT] = useTransition();

  function doSave() {
    const kg = Number(v.replace(",", "."));
    if (!kg || kg < 20 || kg > 300) return;
    setStatus("saving");
    startT(async () => {
      const r = await saveWeight(date, kg);
      if (r.ok) {
        setStatus("saved");
        setEditing(false);
        router.refresh();
        setTimeout(() => setStatus("idle"), 1400);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2600);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-[3px] border border-line bg-surface px-3.5 py-2.5">
      <span className="w-14 shrink-0 font-mono text-[11px] text-ink-3">{fmtDate(date)}</span>
      {editing ? (
        <>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="min-w-0 flex-1 rounded-[2px] border border-phase bg-surface px-2 py-1 font-mono text-[13px] text-ink outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") doSave();
              if (e.key === "Escape") { setEditing(false); setV(String(actual)); }
            }}
          />
          <button
            type="button"
            onClick={doSave}
            disabled={status === "saving"}
            className="shrink-0 rounded-[2px] bg-phase px-3 py-1 font-mono text-[12px] text-on-phase disabled:opacity-50"
          >
            {status === "saving" ? "…" : "✓"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setV(String(actual)); }}
            className="shrink-0 font-mono text-[12px] text-ink-3"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 font-mono text-[14px] font-semibold text-ink">
            {actual} <span className="text-[10px] font-normal text-ink-3">кг</span>
          </span>
          <button
            type="button"
            onClick={() => { setV(String(actual)); setEditing(true); }}
            className="shrink-0 font-mono text-[11px] text-phase"
          >
            изм
          </button>
        </>
      )}
    </div>
  );
}

export function WeightHistory({ todayISO, rows }: { todayISO: string; rows: WeightRow[] }) {
  const [showAll, setShowAll] = useState(false);

  const pastEntries = [...rows]
    .filter((r): r is WeightRow & { actual: number } => r.actual != null && r.date !== todayISO)
    .reverse();
  const visible = showAll ? pastEntries : pastEntries.slice(0, 7);

  if (pastEntries.length === 0) return null;

  return (
    <div className="mt-3.5">
      <p className="mb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        история веса
      </p>
      <div className="space-y-1.5">
        {visible.map((e) => <HistoryRow key={e.date} date={e.date} actual={e.actual} />)}
        {pastEntries.length > 7 && (
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="w-full pt-1 font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3"
          >
            {showAll ? "скрыть" : `ещё ${pastEntries.length - 7} дней`}
          </button>
        )}
      </div>
    </div>
  );
}
