import type { WorkoutLogEntry, SportDay, MigraineEvent } from "@/lib/data";

const C_WORKOUT = "rgba(190,140,60,0.88)";
const C_SPORT   = "rgba(55,165,130,0.72)";
const C_BOTH    = "rgba(140,90,185,0.82)";
const C_EMPTY   = "rgba(130,130,130,0.09)";
const C_MIG     = "#d04830";

const CELL = 13;
const GAP  = 2;
const STEP = CELL + GAP;
const DAY_LABEL_W = 22;
const MONTH_H = 16;
const LEGEND_H = 28;

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
  const workoutMap = new Map<string, WorkoutLogEntry>();
  for (const w of workouts) workoutMap.set(w.date, w);

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
  for (const w of workouts) wByDow[isoDow(w.date)]++;
  for (const s of sports)   sByDow[isoDow(s.date)]++;
  for (const m of migraines) mByDow[isoDow(m.date)]++;
  const maxBar = Math.max(...wByDow.map((w, i) => w + sByDow[i]), 1);

  const BAR_W    = 38;
  const BAR_GAP  = 4;
  const BAR_STEP = BAR_W + BAR_GAP;
  const CHART_H  = 64;
  const BTXT_H   = 24;
  const BAR_SVG_W = 7 * BAR_STEP - BAR_GAP;
  const BAR_SVG_H = CHART_H + BTXT_H;

  const legendItems = [
    { color: C_WORKOUT, label: "тренировка" },
    { color: C_SPORT,   label: "спорт" },
    { color: C_BOTH,    label: "оба" },
  ];

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
                const hasW = workoutMap.has(date);
                const hasS = sportSet.has(date);
                const hasM = migraineSet.has(date);
                const future = date > todayISO;
                const fill = future ? "none"
                  : (hasW && hasS) ? C_BOTH
                  : hasW ? C_WORKOUT
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

            {/* Legend */}
            {legendItems.map(({ color, label }, i) => {
              const lx = DAY_LABEL_W + i * 76;
              const ly = MONTH_H + 7 * STEP - GAP + 10;
              return (
                <g key={i}>
                  <rect x={lx} y={ly} width={9} height={9} rx={2} fill={color} />
                  <text x={lx + 12} y={ly + 8} fontSize={7} fill="rgba(100,100,100,0.55)" fontFamily="monospace">
                    {label}
                  </text>
                </g>
              );
            })}
            <g>
              <circle cx={DAY_LABEL_W + 3 * 76 + 4} cy={MONTH_H + 7 * STEP - GAP + 14} r={4} fill={C_MIG} />
              <text x={DAY_LABEL_W + 3 * 76 + 12} y={MONTH_H + 7 * STEP - GAP + 18} fontSize={7} fill="rgba(100,100,100,0.55)" fontFamily="monospace">
                мигрень
              </text>
            </g>
          </svg>
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
                    <rect x={x} y={CHART_H - sH} width={BAR_W} height={sH} rx={2} fill={C_SPORT} />
                  )}
                  {wH > 0 && (
                    <rect x={x} y={CHART_H - sH - wH} width={BAR_W} height={wH}
                      rx={wH > 3 ? 2 : 0} fill={C_WORKOUT} />
                  )}
                  {total > 0 && (
                    <text x={x + BAR_W / 2} y={CHART_H - sH - wH - 3}
                      textAnchor="middle" fontSize={8} fontFamily="monospace"
                      fill="rgba(80,80,80,0.65)">
                      {total}
                    </text>
                  )}
                  {/* Day label */}
                  <text x={x + BAR_W / 2} y={CHART_H + 11}
                    textAnchor="middle" fontSize={8.5} fontFamily="monospace"
                    fill="rgba(80,80,80,0.6)">
                    {label}
                  </text>
                  {/* Migraine dots under label */}
                  {Array.from({ length: Math.min(mCnt, 5) }).map((_, mi) => (
                    <circle key={mi} cx={x + BAR_W / 2 - (Math.min(mCnt, 5) - 1) * 3 + mi * 6}
                      cy={CHART_H + 20} r={2} fill={C_MIG} />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
