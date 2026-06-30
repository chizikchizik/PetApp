"use client";
import { useState } from "react";
import type { MonthBar } from "@/lib/insights";

const PAGE = 12;
const H = 96;

export function MigraineChart({ bars }: { bars: MonthBar[] }) {
  const totalPages = Math.max(1, Math.ceil(bars.length / PAGE));
  const [page, setPage] = useState(totalPages - 1);

  const pageStart = page * PAGE;
  const pageBars = bars.slice(pageStart, pageStart + PAGE);

  const maxTotal = Math.max(...pageBars.map((b) => b.total), 0);
  const scale = Math.max(12, maxTotal + 1);

  const firstLabel = pageBars[0] ? `${pageBars[0].label} ${pageBars[0].ym.slice(0, 4)}` : "";
  const lastLabel = pageBars[pageBars.length - 1]
    ? `${pageBars[pageBars.length - 1].label} ${pageBars[pageBars.length - 1].ym.slice(0, 4)}`
    : "";

  return (
    <div>
      {/* Navigation */}
      {totalPages > 1 && (
        <div className="mb-3 flex items-center justify-between">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="font-mono text-[11px] tracking-[0.06em] text-ink-3 transition hover:text-ink disabled:opacity-25"
          >
            ← раньше
          </button>
          <span className="font-mono text-[9px] tracking-[0.06em] text-ink-3">
            {firstLabel} — {lastLabel}
          </span>
          <button
            disabled={page === totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="font-mono text-[11px] tracking-[0.06em] text-ink-3 transition hover:text-ink disabled:opacity-25"
          >
            позже →
          </button>
        </div>
      )}

      {/* Bars */}
      <div className="relative flex h-[104px] items-end gap-[5px]">
        {/* 10-day threshold line */}
        <div
          className="pointer-events-none absolute inset-x-0 flex items-center"
          style={{ bottom: `${(10 / scale) * H}px` }}
        >
          <div className="h-px flex-1 border-t border-dashed border-warn" />
          <span className="ml-1 font-mono text-[9px] text-warn">10</span>
        </div>

        {pageBars.map((b) => {
          const triptanH = b.triptan > 0 ? Math.max(4, Math.round((b.triptan / scale) * H)) : 0;
          const noTriptanH =
            b.total > b.triptan ? Math.max(3, Math.round(((b.total - b.triptan) / scale) * H)) : 0;
          const color = b.triptan >= 10 ? "var(--warn)" : "var(--phase)";
          return (
            <div
              key={b.ym}
              title={`${b.label} ${b.ym.slice(0, 4)}: ${b.total} пр. (${b.triptan} с трипт.)`}
              className="flex flex-1 flex-col items-stretch justify-end"
            >
              {noTriptanH > 0 && (
                <div
                  style={{
                    height: `${noTriptanH}px`,
                    background: "var(--phase)",
                    opacity: 0.35,
                    borderRadius: triptanH > 0 ? "1px 1px 0 0" : "1px 1px 0 0",
                  }}
                />
              )}
              {triptanH > 0 ? (
                <div style={{ height: `${triptanH}px`, background: color }} />
              ) : b.total === 0 ? (
                <div style={{ height: "3px", background: "var(--surface-3)", borderRadius: "1px" }} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Month labels */}
      <div className="mt-1.5 flex gap-[5px]">
        {pageBars.map((b) => (
          <span key={b.ym} className="flex-1 text-center font-mono text-[8px] text-ink-3">
            {b.label}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex items-center gap-4 font-mono text-[9px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[10px] w-[10px] rounded-[1px]"
            style={{ background: "var(--phase)" }}
          />
          с триптаном
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[10px] w-[10px] rounded-[1px]"
            style={{ background: "var(--phase)", opacity: 0.35 }}
          />
          без триптана
        </span>
      </div>
    </div>
  );
}
