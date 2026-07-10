"use client";
import { useState } from "react";
import type { MonthBar } from "@/lib/insights";

const RU_MONTHS_FULL = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

function pluralAttacks(n: number): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "приступов";
  if (b === 1) return "приступ";
  if (b >= 2 && b <= 4) return "приступа";
  return "приступов";
}

// Разбивка по календарным месяцам с числом приступов (в стиле MigreBot):
// список месяцев с ≥1 приступом, свежие сверху, с разделителями по годам и
// годовым итогом. Свёрнуто — последние 12 месяцев с приступами.
export function MonthBreakdown({ bars }: { bars: MonthBar[] }) {
  const [showAll, setShowAll] = useState(false);

  const rows = [...bars].filter((b) => b.total > 0).reverse(); // desc по дате
  if (rows.length === 0) {
    return (
      <p className="mt-3 font-mono text-[12px] text-ink-3">Приступов за период не отмечено.</p>
    );
  }

  // Годовые итоги — по всему массиву, а не только по видимому срезу.
  const yearTotal = new Map<string, number>();
  for (const b of bars) {
    const y = b.ym.slice(0, 4);
    yearTotal.set(y, (yearTotal.get(y) ?? 0) + b.total);
  }

  const visible = showAll ? rows : rows.slice(0, 12);

  let lastYear = "";
  const items: React.ReactNode[] = [];
  for (const b of visible) {
    const year = b.ym.slice(0, 4);
    const monthIdx = parseInt(b.ym.slice(5, 7)) - 1;
    if (year !== lastYear) {
      lastYear = year;
      items.push(
        <div key={`y-${year}`} className="mt-3 flex items-baseline justify-between border-b border-line pb-1 first:mt-0">
          <span className="font-mono text-[11px] tracking-[0.1em] text-ink-2">{year}</span>
          <span className="font-mono text-[10px] text-ink-3">
            {yearTotal.get(year)} {pluralAttacks(yearTotal.get(year) ?? 0)} за год
          </span>
        </div>,
      );
    }
    const barPct = Math.min(100, Math.round((b.total / 12) * 100));
    items.push(
      <div key={b.ym} className="flex items-center gap-3 py-1.5">
        <span className="w-24 shrink-0 font-sans text-[13px] text-ink">{RU_MONTHS_FULL[monthIdx]}</span>
        <div className="h-[6px] flex-1 overflow-hidden rounded-[1px] bg-surface-3">
          <div
            className="h-full rounded-[1px]"
            style={{ width: `${barPct}%`, background: b.triptan >= 10 ? "var(--warn)" : "var(--phase)" }}
          />
        </div>
        <span className="shrink-0 text-right font-mono text-[13px] font-semibold text-ink" style={{ minWidth: 18 }}>
          {b.total}
        </span>
        {b.triptan > 0 && (
          <span className="shrink-0 font-mono text-[9px] text-ink-3" style={{ minWidth: 40 }}>
            трипт. {b.triptan}
          </span>
        )}
      </div>,
    );
  }

  return (
    <div className="mt-3">
      {items}
      {rows.length > 12 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full pt-1 font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3"
        >
          {showAll ? "свернуть" : `показать все · ${rows.length} месяцев`}
        </button>
      )}
    </div>
  );
}
