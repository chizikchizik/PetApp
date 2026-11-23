import type { CycleHistoryRow } from "@/lib/data";

const RU3 = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"];

// HTML, а не SVG: шкала в 40 дней тянется по ширине экрана, подписи —
// обычный текст 10–11 px. Раньше SVG фиксированной ширины 364 px давал
// подписи 6–8,5 px и горизонтальную прокрутку на телефоне (QA раунд 8).
const DAYS    = 40;
const ROW_H   = 21;
const LABEL_W = 48;
const DAY_TICKS = [1, 5, 10, 14, 20, 25, 30, 35, 40];

const MENS_FILL  = "rgba(196,80,110,0.18)";
const MIG_FILL   = "#d04830";
const CYCLE_FILL = "rgba(130,130,130,0.07)";
const GRID_LINE  = "rgba(130,130,130,0.18)";
const YEAR_LINE  = "rgba(130,130,130,0.35)";

const pct = (days: number) => `${(days / DAYS) * 100}%`;

export function CycleHistoryChart({ rows }: { rows: CycleHistoryRow[] }) {
  if (!rows.length) {
    return <p className="font-mono text-[12px] text-ink-3">Нет данных по циклам</p>;
  }

  // Месяцы с двумя началами цикла — к названию месяца добавляем число.
  const monthCount = new Map<string, number>();
  for (const row of rows) {
    const ym = row.start.slice(0, 7);
    monthCount.set(ym, (monthCount.get(ym) ?? 0) + 1);
  }

  const items: Array<{ kind: "year"; year: number } | { kind: "cycle"; row: CycleHistoryRow }> = [];
  let prevYear: number | null = null;
  for (const row of rows) {
    const year = parseInt(row.start.slice(0, 4));
    if (year !== prevYear) {
      items.push({ kind: "year", year });
      prevYear = year;
    }
    items.push({ kind: "cycle", row });
  }

  return (
    <div
      className="overflow-y-auto rounded-[6px] border border-line"
      style={{ maxHeight: 480, WebkitOverflowScrolling: "touch" }}
      role="img"
      aria-label="История мигреней по циклу: строка — цикл, точка — день мигрени"
    >
      {/* Шкала дней цикла */}
      <div className="sticky top-0 z-10 flex bg-surface pr-1.5">
        <div className="shrink-0" style={{ width: LABEL_W }} />
        <div className="relative h-[18px] flex-1" aria-hidden>
          {DAY_TICKS.map((d) => (
            <span
              key={d}
              className="absolute top-[3px] -translate-x-1/2 font-mono text-[10px] leading-none text-ink-3"
              style={{ left: pct(d - 0.5) }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      <div className="relative pb-1 pr-1.5">
        {/* Вертикальная сетка по отметкам дней */}
        <div className="pointer-events-none absolute inset-y-0 right-1.5" style={{ left: LABEL_W }} aria-hidden>
          {DAY_TICKS.map((d) => (
            <span key={d} className="absolute inset-y-0 w-px" style={{ left: pct(d - 1), background: GRID_LINE }} />
          ))}
        </div>

        {items.map((item) => {
          if (item.kind === "year") {
            return (
              <div
                key={`year-${item.year}`}
                className="flex items-center border-t"
                style={{ height: ROW_H, borderColor: YEAR_LINE }}
              >
                <span
                  className="shrink-0 pr-1.5 text-right font-mono text-[11px] font-bold leading-none text-ink-2"
                  style={{ width: LABEL_W }}
                >
                  {item.year}
                </span>
              </div>
            );
          }

          const { row } = item;
          const label = RU3[parseInt(row.start.slice(5, 7)) - 1];
          const day = parseInt(row.start.slice(8, 10));
          const hasDup = (monthCount.get(row.start.slice(0, 7)) ?? 0) > 1;

          return (
            <div key={row.start} className="flex items-center" style={{ height: ROW_H }}>
              <span
                className="shrink-0 whitespace-nowrap pr-1.5 text-right font-mono text-[11px] leading-none text-ink-3"
                style={{ width: LABEL_W }}
              >
                {label}
                {hasDup && ` ${day}`}
              </span>
              <div className="relative h-[17px] flex-1">
                {row.length <= DAYS && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-[1px]"
                    style={{ width: pct(Math.min(row.length, DAYS)), background: CYCLE_FILL }}
                  />
                )}
                <div
                  className="absolute inset-y-0 left-0 rounded-[1px]"
                  style={{ width: pct(Math.min(5, row.length)), background: MENS_FILL }}
                />
                {row.migraineDays.map((d) =>
                  d <= DAYS ? (
                    <span
                      key={d}
                      className="absolute top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: pct(d - 0.5), background: MIG_FILL }}
                    />
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
