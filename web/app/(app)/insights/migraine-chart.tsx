"use client";
import { useState } from "react";
import type { MonthBar } from "@/lib/insights";

const H = 96;
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const GUIDE = 10; // ориентир дней с триптанами и др. в месяц (ICHD-3 8.2)

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 100, b = n % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

// Приступы по месяцам, одна страница — один календарный год (янв–дек).
// По умолчанию открыт текущий год; будущие месяцы — пустые места.
export function MigraineChart({ bars, todayYM }: { bars: MonthBar[]; todayYM: string }) {
  const currentYear = Number(todayYM.slice(0, 4));
  const firstYear = bars.length ? Number(bars[0].ym.slice(0, 4)) : currentYear;
  const [year, setYear] = useState(currentYear);

  const byYm = new Map(bars.map((b) => [b.ym, b]));
  const yearBars = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
    const b = byYm.get(ym);
    return { ym, label: MONTHS_SHORT[i], total: b?.total ?? 0, triptan: b?.triptan ?? 0, future: ym > todayYM };
  });
  const yearTotal = yearBars.reduce((s, b) => s + b.total, 0);
  const maxTotal = Math.max(...yearBars.map((b) => b.total), 0);
  const scale = Math.max(12, maxTotal + 1);

  const navBtn = "flex min-h-[40px] items-center px-1 font-mono text-[12px] text-ink-2 transition disabled:opacity-25";

  return (
    <div>
      {/* Навигация по годам */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" disabled={year <= firstYear} onClick={() => setYear((y) => y - 1)} className={navBtn}>
          ← {year - 1}
        </button>
        <span className="font-mono text-[12px] text-ink">
          <b className="font-semibold">{year}</b>
          <span className="text-ink-2"> · {yearTotal} {plural(yearTotal, "приступ", "приступа", "приступов")}</span>
        </span>
        <button type="button" disabled={year >= currentYear} onClick={() => setYear((y) => y + 1)} className={navBtn}>
          {year + 1} →
        </button>
      </div>

      {/* Столбцы */}
      <div className="relative flex h-[118px] items-end gap-[4px] pt-[14px]">
        <div
          className="pointer-events-none absolute inset-x-0 flex items-center"
          style={{ bottom: `${(GUIDE / scale) * H}px` }}
        >
          <div className="h-px flex-1 border-t border-dashed border-caution" />
          <span className="ml-1 font-mono text-[11px] text-caution">{GUIDE}</span>
        </div>

        {yearBars.map((b) => {
          const triptanH = b.triptan > 0 ? Math.max(4, Math.round((b.triptan / scale) * H)) : 0;
          const noTriptanH = b.total > b.triptan ? Math.max(3, Math.round(((b.total - b.triptan) / scale) * H)) : 0;
          const color = b.triptan >= GUIDE ? "var(--caution)" : "var(--phase)";
          return (
            <div
              key={b.ym}
              title={b.future ? `${b.label} ${year}` : `${b.label} ${year}: ${b.total} пр., из них ${b.triptan} с триптаном и др.`}
              className="flex min-w-0 flex-1 flex-col items-stretch justify-end"
            >
              {b.total > 0 && (
                <span className="mb-0.5 text-center font-mono text-[11px] leading-none text-ink-2">{b.total}</span>
              )}
              {noTriptanH > 0 && (
                <div style={{ height: `${noTriptanH}px`, background: "var(--phase)", opacity: 0.35, borderRadius: "1px 1px 0 0" }} />
              )}
              {triptanH > 0 ? (
                <div style={{ height: `${triptanH}px`, background: color, borderRadius: noTriptanH > 0 ? 0 : "1px 1px 0 0" }} />
              ) : b.total === 0 ? (
                <div
                  style={{
                    height: "3px",
                    borderRadius: "1px",
                    background: b.future ? "transparent" : "var(--surface-3)",
                    border: b.future ? "1px dashed var(--line-2)" : undefined,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Подписи месяцев */}
      <div className="mt-1.5 flex gap-[4px]">
        {yearBars.map((b) => (
          <span
            key={b.ym}
            className={`min-w-0 flex-1 text-center font-mono text-[11px] ${b.ym === todayYM ? "font-semibold text-ink" : b.future ? "text-ink-4" : "text-ink-3"}`}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Легенда */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[10px] w-[10px] rounded-[1px]" style={{ background: "var(--phase)" }} />
          с триптаном и др.
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[10px] w-[10px] rounded-[1px]" style={{ background: "var(--phase)", opacity: 0.35 }} />
          без них
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 border-t border-dashed border-caution" />
          ориентир {GUIDE} дней
        </span>
      </div>
    </div>
  );
}
