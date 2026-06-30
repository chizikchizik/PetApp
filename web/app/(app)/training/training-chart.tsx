import type { WorkoutLogEntry, SportDay, MigraineEvent } from "@/lib/data";

const C_GYM        = "rgba(190,140,60,0.88)";   // зал
const C_VOLLEYBALL = "rgba(55,120,215,0.88)";   // волейбол
const C_RUN        = "rgba(210,95,55,0.88)";    // бег
const C_OTHER_W    = "rgba(80,175,85,0.78)";    // прочие тренировки
const C_SPORT      = "rgba(55,165,130,0.72)";   // спорт (привычки)
const C_EMPTY      = "rgba(130,130,130,0.09)";
const C_MIG        = "#d04830";

function typeColor(types: string[]): string {
  const s = types.join(" ").toLowerCase();
  if (s.includes("волейбол")) return C_VOLLEYBALL;
  if (s.includes("бег"))      return C_RUN;
  if (s.includes("зал"))      return C_GYM;
  return C_OTHER_W;
}

const CELL = 13;
const GAP  = 2;
const STEP = CELL + GAP;
const DAY_LABEL_W = 22;
const MONTH_H = 16;
const LEGEND_H = 0;

const DAY_LABELS = ["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"];
const MONTHS_RU  = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"];

function isoDow(dateISO: string): number {
  const d = new Date(dateISO + "T12:00:00");
  return (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
}

export function TrainingChart({
  workouts,
  sports,
  migraines,
}: {
  workouts: WorkoutLogEntry[];
  sports: SportDay[];
  migraines: MigraineEvent[];
}) {
  const workoutTypeMap = new Map<string, string[]>();
  for (const w of workouts) {
    const existing = workoutTypeMap.get(w.date) ?? [];
    workoutTypeMap.set(w.date, [...existing, w.type]);
  }

  const sportSet = new Set<string>();
  for (const s of sports) sportSet.add(s.date);

  const migraineSet = new Set<string>();
  for (const m of migraines) migraineSet.add(m.date);

  // Build calendar grid: 26 weeks, starting on the Monday before 26w ago
  const todayISO = new Date().toISOString().slice(0, 10);
  const today = new Date(todayISO + "T12:00:00");
  const start = new Date(today);
  start.setDate(today.getDate() - 26 * 7);
  const startDow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - startDow);

  const weeks: string[][] = [];
  const cur = new Date(start);
  while (cur.toISOString().slice(0, 10) <= todayISO) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const N = weeks.length;
  const SVG_W = DAY_LABEL_W + N * STEP - GAP + 4;
  const SVG_H = MONTH_H + 7 * STEP - GAP + LEGEND_H;

  // Month label positions
  const monthLabels: { wi: number; month: number }[] = [];
  let lastM = -1;
  weeks.forEach((week, wi) => {
    const m = parseInt(week[0].slice(5, 7)) - 1;
    if (m !== lastM) { monthLabels.push({ wi, month: m }); lastM = m; }
  });

  // Day-of-week stats
  const wByDow = new Array(7).fill(0);
  const sByDow = new Array(7).fill(0);
  const mByDow = new Array(7).fill(0);
  for (const [date] of workoutTypeMap) wByDow[isoDow(date)]++;
  for (const s of sports)   sByDow[isoDow(s.date)]++;
  for (const m of migraines) mByDow[isoDow(m.date)]++;
  const maxBar = Math.max(...wByDow.map((w, i) => w + sByDow[i]), 1);
  const maxMig = Math.max(...mByDow, 1);

  const BAR_W    = 38;
  const BAR_GAP  = 4;
  const BAR_STEP = BAR_W + BAR_GAP;
  const CHART_H  = 64;
  const TOP_PAD  = 14;  // room for count label above tallest bar
  const BTXT_H   = 14; // just day labels now
  const BAR_SVG_W = 7 * BAR_STEP - BAR_GAP;
  const BAR_SVG_H = TOP_PAD + CHART_H + BTXT_H;

  // Auto-build legend: top workout types by frequency, deduplicated by color
  const typeCounts = new Map<string, number>();
  for (const w of workouts) typeCounts.set(w.type, (typeCounts.get(w.type) ?? 0) + 1);
  const colorToLabel = new Map<string, string>();
  for (const [type] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const col = typeColor([type]);
    if (!colorToLabel.has(col)) colorToLabel.set(col, type.toLowerCase());
    if (colorToLabel.size >= 4) break;
  }
  type LegendItem = { color: string; label: string; circle?: boolean };
  const legendItems: LegendItem[] = [...colorToLabel.entries()].map(([color, label]) => ({ color, label }));
  if (sports.length > 0) legendItems.push({ color: C_SPORT, label: "спорт" });
  if (migraines.length > 0) legendItems.push({ color: C_MIG, label: "мигрень", circle: true });

  return (
    <div className="mt-5 space-y-4">
      {/* ── Heatmap ── */}
      <div>
        <p className="mb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          история · {weeks[0]?.[0]?.slice(0, 7)} — {todayISO.slice(0, 7)}
        </p>
        <div className="rounded-[6px] border border-line" style={{ overflowX: "auto" }}>
          <svg width={SVG_W} height={SVG_H} style={{ display: "block", minWidth: SVG_W, padding: "4px 4px 0 0" }}>
            {/* Month labels */}
            {monthLabels.map(({ wi, month }) => (
              <text key={`m${wi}`} x={DAY_LABEL_W + wi * STEP} y={MONTH_H - 4}
                fontSize={7} fill="rgba(100,100,100,0.55)" fontFamily="monospace">
                {MONTHS_RU[month]}
              </text>
            ))}

            {/* Day-of-week labels (ПН, СР, ПТ, ВС) */}
            {DAY_LABELS.map((label, di) => (
              di % 2 === 0 ? (
                <text key={di} x={DAY_LABEL_W - 4} y={MONTH_H + di * STEP + CELL * 0.76}
                  textAnchor="end" fontSize={7} fill="rgba(100,100,100,0.5)" fontFamily="monospace">
                  {label}
                </text>
              ) : null
            ))}

            {/* Cells */}
            {weeks.map((week, wi) =>
              week.map((date, di) => {
                const types = workoutTypeMap.get(date);
                const hasW = !!types;
                const hasS = sportSet.has(date);
                const hasM = migraineSet.has(date);
                const future = date > todayISO;
                const fill = future ? "none"
                  : hasW ? typeColor(types!)
                  : hasS ? C_SPORT
                  : C_EMPTY;
                const x = DAY_LABEL_W + wi * STEP;
                const y = MONTH_H + di * STEP;
                return (
                  <g key={date}>
                    <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={fill} />
                    {hasM && !future && (
                      <circle cx={x + CELL - 2.5} cy={y + 2.5} r={2.5} fill={C_MIG} />
                    )}
                  </g>
                );
              })
            )}

          </svg>
        </div>
        {/* Legend — outside scrollable SVG so it's always visible */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {legendItems.map(({ color, label, circle }, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {circle
                ? <svg width={9} height={9}><circle cx={4.5} cy={4.5} r={4.5} fill={color} /></svg>
                : <svg width={9} height={9}><rect width={9} height={9} rx={2} fill={color} /></svg>
              }
              <span className="font-mono text-[10px] text-ink-3">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── По дням недели ── */}
      <div>
        <p className="mb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          по дням недели
        </p>
        <div className="rounded-[6px] border border-line p-3">
          <svg
            viewBox={`0 0 ${BAR_SVG_W} ${BAR_SVG_H}`}
            style={{ display: "block", width: "100%", height: "auto" }}
          >
            {DAY_LABELS.map((label, i) => {
              const x     = i * BAR_STEP;
              const wCnt  = wByDow[i];
              const sCnt  = sByDow[i];
              const mCnt  = mByDow[i];
              const total = wCnt + sCnt;
              const wH    = (wCnt / maxBar) * CHART_H;
              const sH    = (sCnt / maxBar) * CHART_H;
              return (
                <g key={i}>
                  {sH > 0 && (
                    <rect x={x} y={TOP_PAD + CHART_H - sH} width={BAR_W} height={sH} rx={2} fill={C_SPORT} />
                  )}
                  {wH > 0 && (
                    <rect x={x} y={TOP_PAD + CHART_H - sH - wH} width={BAR_W} height={wH}
                      rx={wH > 3 ? 2 : 0} fill={C_GYM} />
                  )}
                  {total > 0 && (
                    <text x={x + BAR_W / 2} y={TOP_PAD + CHART_H - sH - wH - 3}
                      textAnchor="middle" fontSize={8} fontFamily="monospace"
                      fill="rgba(80,80,80,0.65)">
                      {total}
                    </text>
                  )}
                  {/* Day label */}
                  <text x={x + BAR_W / 2} y={TOP_PAD + CHART_H + 11}
                    textAnchor="middle" fontSize={8.5} fontFamily="monospace"
                    fill="rgba(80,80,80,0.6)">
                    {label}
                  </text>
                  {/* Migraine overlay bars — own scale */}
                  {mCnt > 0 && (() => {
                    const mH = (mCnt / maxMig) * CHART_H;
                    const mY = TOP_PAD + CHART_H - mH;
                    return (
                      <g>
                        <rect x={x} y={mY} width={BAR_W} height={mH}
                          rx={2} fill="rgba(208,72,48,0.28)" />
                        <text x={x + BAR_W / 2} y={mY - 2}
                          textAnchor="middle" fontSize={7} fontFamily="monospace"
                          fill={C_MIG}>
                          {mCnt}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
