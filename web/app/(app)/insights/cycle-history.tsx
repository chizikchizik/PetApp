import type { CycleHistoryRow } from "@/lib/data";

const RU3 = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"];

const ROW_H  = 21;
const LABEL_W = 38;
const DAY_W  = 8;
const DAYS   = 40;
const HEADER = 18;
const RIGHT  = 6;
const SVG_W  = LABEL_W + DAYS * DAY_W + RIGHT;

// Color constants matching VERTA design tokens (baked in since SVG can't use CSS vars inside fill attr in all browsers)
const MENS_FILL  = "rgba(196,80,110,0.18)";
const MIG_FILL   = "#d04830";
const CYCLE_FILL = "rgba(130,130,130,0.07)";
const GRID_LINE  = "rgba(130,130,130,0.18)";
const YEAR_LINE  = "rgba(130,130,130,0.35)";

export function CycleHistoryChart({ rows }: { rows: CycleHistoryRow[] }) {
  if (!rows.length) {
    return (
      <p className="font-mono text-[12px] text-ink-3">Нет данных по циклам</p>
    );
  }

  // Detect months with >1 cycle start (e.g. two cycles in March 2026)
  const monthYearCount = new Map<string, number>();
  for (const row of rows) {
    const ym = row.start.slice(0, 7);
    monthYearCount.set(ym, (monthYearCount.get(ym) ?? 0) + 1);
  }

  // Build render list: inject year-separator pseudo-rows
  type Item =
    | { kind: "year"; year: number; idx: number }
    | { kind: "cycle"; row: CycleHistoryRow; idx: number };

  const items: Item[] = [];
  let prevYear: number | null = null;
  let yIdx = 0; // visual row index (separator = 0.5 row)

  const renderItems: Array<{ item: Item; y: number }> = [];

  for (const row of rows) {
    const year = parseInt(row.start.slice(0, 4));
    if (year !== prevYear) {
      renderItems.push({ item: { kind: "year", year, idx: yIdx }, y: yIdx * ROW_H + HEADER });
      yIdx += 0.85;
      prevYear = year;
    }
    renderItems.push({ item: { kind: "cycle", row, idx: yIdx }, y: yIdx * ROW_H + HEADER });
    yIdx += 1;
  }

  const SVG_H = Math.ceil(yIdx * ROW_H) + HEADER + 4;

  // Day tick marks at top
  const DAY_TICKS = [1, 5, 10, 14, 20, 25, 30, 35, 40];

  return (
    <div
      className="overflow-y-auto rounded-[6px] border border-line"
      style={{ maxHeight: 480, WebkitOverflowScrolling: "touch" }}
    >
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ display: "block", minWidth: SVG_W }}
        aria-label="История мигреней по циклу"
      >
        {/* ── Day header ── */}
        {DAY_TICKS.map((d) => (
          <text
            key={d}
            x={LABEL_W + (d - 0.5) * DAY_W}
            y={HEADER - 4}
            textAnchor="middle"
            fontSize={7}
            fill="rgba(100,100,100,0.55)"
            fontFamily="monospace"
          >
            {d}
          </text>
        ))}

        {/* ── Vertical grid lines at ticks ── */}
        {DAY_TICKS.map((d) => (
          <line
            key={d}
            x1={LABEL_W + (d - 1) * DAY_W}
            y1={HEADER}
            x2={LABEL_W + (d - 1) * DAY_W}
            y2={SVG_H}
            stroke={GRID_LINE}
            strokeWidth={0.5}
          />
        ))}

        {/* ── Rows ── */}
        {renderItems.map(({ item, y }) => {
          if (item.kind === "year") {
            return (
              <g key={`year-${item.year}`}>
                <line
                  x1={0} y1={y + ROW_H * 0.35}
                  x2={SVG_W} y2={y + ROW_H * 0.35}
                  stroke={YEAR_LINE} strokeWidth={0.8}
                />
                <text
                  x={LABEL_W - 4}
                  y={y + ROW_H * 0.8}
                  textAnchor="end"
                  fontSize={8.5}
                  fontWeight="700"
                  fill="rgba(80,80,80,0.7)"
                  fontFamily="monospace"
                >
                  {item.year}
                </text>
              </g>
            );
          }

          const { row } = item;
          const month = parseInt(row.start.slice(5, 7)) - 1;
          const label = RU3[month];
          const day = parseInt(row.start.slice(8, 10));
          const hasDup = (monthYearCount.get(row.start.slice(0, 7)) ?? 0) > 1;
          const cycleBarW = Math.min(row.length, DAYS) * DAY_W;
          const mensW = Math.min(5, row.length) * DAY_W;

          return (
            <g key={row.start}>
              {/* Month label — show day below when two cycles share same month */}
              <text
                x={LABEL_W - 5}
                y={y + ROW_H * (hasDup ? 0.45 : 0.68)}
                textAnchor="end"
                fontSize={7.5}
                fill="rgba(100,100,100,0.65)"
                fontFamily="monospace"
              >
                {label}
              </text>
              {hasDup && (
                <text
                  x={LABEL_W - 5}
                  y={y + ROW_H * 0.85}
                  textAnchor="end"
                  fontSize={6}
                  fill="rgba(100,100,100,0.45)"
                  fontFamily="monospace"
                >
                  {day}
                </text>
              )}

              {/* Cycle background bar (full length) */}
              {row.length <= DAYS && (
                <rect
                  x={LABEL_W}
                  y={y + 2}
                  width={cycleBarW}
                  height={ROW_H - 4}
                  rx={1}
                  fill={CYCLE_FILL}
                />
              )}

              {/* Menstrual band (days 1–5) */}
              <rect
                x={LABEL_W}
                y={y + 2}
                width={mensW}
                height={ROW_H - 4}
                rx={1}
                fill={MENS_FILL}
              />

              {/* Migraine dots */}
              {row.migraineDays.map((d) =>
                d <= DAYS ? (
                  <circle
                    key={d}
                    cx={LABEL_W + (d - 0.5) * DAY_W}
                    cy={y + ROW_H / 2}
                    r={3.2}
                    fill={MIG_FILL}
                  />
                ) : null
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
