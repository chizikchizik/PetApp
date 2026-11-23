"use client";
import { useState } from "react";
import type { MonthBar } from "@/lib/insights";

const H = 96;
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export type MonthMedDays = { total: number; highRisk: number; nsaid: number; level: "ok" | "near" | "over" };

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 100, b = n % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

// Приступы по месяцам, одна страница — один календарный год (янв–дек).
// Решение Елены (23.11.2026): столбцы — только приступы, одним цветом; без
// линии «ориентир 10» — она про дни приёма, а на оси приступов читалась как
// «предел приступов». Дни приёма — отдельным рядом цифр под месяцами, тот же
// счёт, что на плитках дневника; янтарная — близко к ориентиру или выше.
export function MigraineChart({
  bars,
  todayYM,
  medDays,
}: {
  bars: MonthBar[];
  todayYM: string;
  medDays: Record<string, MonthMedDays>;
}) {
  const currentYear = Number(todayYM.slice(0, 4));
  const firstYear = bars.length ? Number(bars[0].ym.slice(0, 4)) : currentYear;
  const [year, setYear] = useState(currentYear);

  const byYm = new Map(bars.map((b) => [b.ym, b]));
  const yearBars = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { ym, label: MONTHS_SHORT[i], total: byYm.get(ym)?.total ?? 0, med: medDays[ym], future: ym > todayYM };
  });
  const yearTotal = yearBars.reduce((s, b) => s + b.total, 0);
  const maxTotal = Math.max(...yearBars.map((b) => b.total), 0);
  const scale = Math.max(8, maxTotal + 1);

  const navBtn = "flex min-h-[44px] items-center px-1 font-mono text-[12px] text-ink-2 transition disabled:opacity-25";

  const tip = (b: (typeof yearBars)[number]) => {
    if (b.future) return `${b.label} ${year}`;
    const head = `${b.label} ${year}: ${b.total} ${plural(b.total, "день", "дня", "дней")} с приступом`;
    if (!b.med || b.med.total === 0) return `${head} · обезболивающие не отмечены`;
    return `${head} · дней с обезболивающими ${b.med.total} (триптаны и др. ${b.med.highRisk}, НПВС ${b.med.nsaid})`;
  };

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

      {/* Столбцы: приступы */}
      <div className="flex h-[118px] items-end gap-[4px] pt-[14px]">
        {yearBars.map((b) => {
          const h = b.total > 0 ? Math.max(4, Math.round((b.total / scale) * H)) : 0;
          return (
            <div
              key={b.ym}
              title={tip(b)}
              aria-label={tip(b)}
              className="flex min-w-0 flex-1 flex-col items-stretch justify-end"
            >
              {b.total > 0 && (
                <span className="mb-0.5 text-center font-mono text-[11px] leading-none text-ink-2">{b.total}</span>
              )}
              {h > 0 ? (
                <div style={{ height: `${h}px`, background: "var(--phase)", borderRadius: "1px 1px 0 0" }} />
              ) : (
                <div
                  style={{
                    height: "3px",
                    borderRadius: "1px",
                    background: b.future ? "transparent" : "var(--surface-3)",
                    border: b.future ? "1px dashed var(--line-2)" : undefined,
                  }}
                />
              )}
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

      {/* Дни с обезболивающими */}
      <div className="mt-1 flex gap-[4px]" aria-label="дни с обезболивающими по месяцам">
        {yearBars.map((b) => (
          <span
            key={b.ym}
            className={`min-w-0 flex-1 text-center font-mono text-[11px] leading-[18px] ${
              b.med && b.med.level !== "ok" ? "font-semibold text-caution" : "text-ink-3"
            }`}
          >
            {b.future || !b.med ? "" : b.med.total}
          </span>
        ))}
      </div>

      {/* Легенда */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[10px] w-[10px] rounded-[1px]" style={{ background: "var(--phase)" }} />
          приступы
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-ink-3">8</span>
          дни с обезболивающими
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-caution">8</span>
          близко к ориентиру или выше — см. дневник месяца
        </span>
      </div>
      <p className="mt-2 font-sans text-[12px] leading-[1.55] text-ink-2">
        Столбцы — приступы, цифры — дни приёма обезболивающих. Ориентиры счётчика
        относятся к дням приёма, а не к числу приступов.
      </p>
    </div>
  );
}
