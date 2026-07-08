"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCalories } from "./actions";
import type { CalorieEntry } from "@/lib/data";

const RU_MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

function HistoryRow({ entry }: { entry: CalorieEntry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(entry.kcal));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startT] = useTransition();

  function doSave() {
    const kcal = Number(v.replace(",", "."));
    if (!kcal || kcal < 100 || kcal > 10000) return;
    setStatus("saving");
    startT(async () => {
      const r = await saveCalories(entry.date, kcal);
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
      <span className="w-14 shrink-0 font-mono text-[11px] text-ink-3">{fmtDate(entry.date)}</span>
      {editing ? (
        <>
          <input
            type="number"
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="min-w-0 flex-1 rounded-[2px] border border-phase bg-surface px-2 py-1 font-mono text-[13px] text-ink outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") doSave();
              if (e.key === "Escape") { setEditing(false); setV(String(entry.kcal)); }
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
            onClick={() => { setEditing(false); setV(String(entry.kcal)); }}
            className="shrink-0 font-mono text-[12px] text-ink-3"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 font-mono text-[14px] font-semibold text-ink">
            {entry.kcal.toLocaleString("ru")}{" "}
            <span className="text-[10px] font-normal text-ink-3">ккал</span>
          </span>
          <button
            type="button"
            onClick={() => { setV(String(entry.kcal)); setEditing(true); }}
            className="shrink-0 font-mono text-[11px] text-phase"
          >
            изм
          </button>
        </>
      )}
    </div>
  );
}

export function CalorieInput({
  todayISO,
  history,
}: {
  todayISO: string;
  history: CalorieEntry[];
}) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showAll, setShowAll] = useState(false);
  const [, startT] = useTransition();

  const selectedEntry = history.find((e) => e.date === selectedDate);
  const pastEntries = [...history].filter((e) => e.date !== todayISO).reverse();
  const visible = showAll ? pastEntries : pastEntries.slice(0, 7);

  const isToday = selectedDate === todayISO;

  function doSave() {
    const kcal = Number(v.replace(",", "."));
    if (!kcal || kcal < 100 || kcal > 10000) return;
    setStatus("saving");
    startT(async () => {
      const r = await saveCalories(selectedDate, kcal);
      if (r.ok) {
        setStatus("saved");
        setV("");
        router.refresh();
        setTimeout(() => setStatus("idle"), 1600);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2600);
      }
    });
  }

  return (
    <div className="mt-3.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          калории
        </p>
        <input
          type="date"
          max={todayISO}
          value={selectedDate}
          onChange={(e) => {
            if (e.target.value) {
              setSelectedDate(e.target.value);
              setV("");
              setStatus("idle");
            }
          }}
          className="rounded-[3px] border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-ink-2 outline-none focus:border-phase"
        />
      </div>

      {selectedEntry && (
        <div className="mb-2 rounded-[3px] border border-phase bg-surface px-4 py-3">
          <span className="font-mono text-[20px] font-semibold text-ink">
            {selectedEntry.kcal.toLocaleString("ru")}
          </span>
          <span className="ml-1.5 font-mono text-[11px] text-ink-3">
            ккал {isToday ? "сегодня" : fmtDate(selectedDate)}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          step="1"
          value={v}
          placeholder={
            selectedEntry
              ? `обновить (${selectedEntry.kcal})`
              : isToday
              ? "ккал за сегодня"
              : `ккал за ${fmtDate(selectedDate)}`
          }
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
          className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-4 py-3 text-[17px] font-semibold text-ink placeholder:text-[13px] placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
        />
        <button
          type="button"
          onClick={doSave}
          disabled={status === "saving" || !v}
          className="shrink-0 rounded-[3px] bg-phase px-5 text-[15px] font-semibold text-on-phase transition active:scale-[0.98] disabled:opacity-50"
        >
          {status === "saving" ? "…" : status === "saved" ? "✓" : status === "error" ? "!" : "Записать"}
        </button>
      </div>

      {pastEntries.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {visible.map((e) => <HistoryRow key={e.date} entry={e} />)}
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
      )}
    </div>
  );
}
