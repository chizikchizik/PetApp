"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePlanPoint, deletePlanPoint } from "./actions";
import type { WeightRow } from "@/lib/data";

const RU_MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} ${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() : ""}`.trim();
}

export function PlanEditor({ rows, todayISO }: { rows: WeightRow[]; todayISO: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [kg, setKg] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [, startT] = useTransition();

  const points = rows.filter((r) => r.plan != null);

  function doSave() {
    const kgNum = Number(kg.replace(",", "."));
    if (!date || !kgNum || kgNum < 30 || kgNum > 250) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
      return;
    }
    setStatus("saving");
    startT(async () => {
      const r = await savePlanPoint(date, kgNum);
      if (r.ok) {
        setStatus("idle");
        setDate("");
        setKg("");
        router.refresh();
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2600);
      }
    });
  }

  function doDelete(dateISO: string) {
    setConfirmDelete(null);
    startT(async () => {
      await deletePlanPoint(dateISO);
      router.refresh();
    });
  }

  return (
    <div className="mt-3.5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          план похудения
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[11px] text-phase"
        >
          {open ? "скрыть" : points.length > 0 ? `${points.length} точек →` : "+ настроить"}
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-card border border-line bg-surface p-3.5">
          <p className="font-mono text-[9px] leading-relaxed text-ink-3">
            Точки «к этой дате хочу весить N кг» — график соединит их ломаной линией плана.
          </p>

          {points.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {points.map((p) => (
                <div key={p.date} className="flex items-center gap-3 rounded-[3px] border border-line bg-surface-2 px-3 py-2">
                  <span className={`w-20 shrink-0 font-mono text-[11px] ${p.date < todayISO ? "text-ink-4" : "text-ink-3"}`}>
                    {fmtDate(p.date)}
                  </span>
                  <span className="flex-1 font-mono text-[13px] font-semibold text-ink">
                    {p.plan} <span className="text-[10px] font-normal text-ink-3">кг</span>
                  </span>
                  {confirmDelete === p.date ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => doDelete(p.date)}
                        className="rounded-[2px] bg-red-600 px-2 py-0.5 font-mono text-[10px] text-white"
                      >
                        Да
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="font-mono text-[10px] text-ink-3"
                      >
                        Нет
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(p.date)}
                      className="shrink-0 font-mono text-[14px] leading-none text-ink-4 transition active:text-ink-2"
                      aria-label={`Удалить точку плана ${p.date}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex gap-2">
            <input
              type="date"
              min={todayISO}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-2.5 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-phase"
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
              placeholder="кг"
              className="w-20 shrink-0 rounded-[3px] border border-line bg-surface px-2.5 py-2.5 font-mono text-[13px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
            />
            <button
              type="button"
              onClick={doSave}
              disabled={status === "saving" || !date || !kg}
              className="shrink-0 rounded-[3px] bg-phase px-4 font-mono text-[13px] font-semibold text-on-phase transition active:scale-[0.98] disabled:opacity-50"
            >
              {status === "saving" ? "…" : status === "error" ? "!" : "✓"}
            </button>
          </div>
          {status === "error" && (
            <p className="mt-1.5 font-mono text-[10px] text-warn">
              Проверь дату и вес (30–250 кг)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
