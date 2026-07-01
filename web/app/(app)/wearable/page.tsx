import Link from "next/link";
import {
  getRecentWearableData,
  getRecentSleepData,
  getMigraineEventsSince,
  type SleepSession,
} from "@/lib/data";
import { isoDaysFromTodayMoscow } from "@/lib/format";

export const dynamic = "force-dynamic";

// ── Chart layout ──────────────────────────────────────────────
const DAY_W  = 24;   // px per day column
const LABEL_W = 22;  // fixed left label column
const MIG    = "#d04830";

const S_H  = 58;  const S_Y  = 0;
const GAP  = 7;
const H_H  = 58;  const H_Y  = S_Y + S_H + GAP;
const SL_H = 78;  const SL_Y = H_Y + H_H + GAP;
const DATE_H = 14; const DATE_Y = SL_Y + SL_H + 5;
const DOT_Y  = DATE_Y + DATE_H + 6;
const TOTAL_H = DOT_Y + 8;

const DIVIDER = "rgba(130,130,140,0.14)";
const LABEL_C = "rgba(130,130,140,0.75)";

// ── Types ─────────────────────────────────────────────────────
type DayData = {
  date: string;
  steps: number | null;
  hrv:   number | null;
  sleep: SleepSession | null;
  migraine: boolean;
};

// ── Data helpers ──────────────────────────────────────────────
function buildDateRange(min: string, max: string): string[] {
  const out: string[] = [];
  const cur = new Date(min);
  const end = new Date(max);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function cx(i: number) { return i * DAY_W + DAY_W / 2; }

// ── Page ──────────────────────────────────────────────────────
export default async function WearablePage() {
  const sinceStr = isoDaysFromTodayMoscow(-40);

  const [wearable, allSleep, migraineEvents] = await Promise.all([
    getRecentWearableData(40),
    getRecentSleepData(40),
    getMigraineEventsSince(sinceStr),
  ]);

  // Night sessions only (>= 3 h)
  const nights = allSleep.filter(s => (s.total_min ?? 0) >= 180);

  // Unified date range — fill gaps
  const allDatesSet = new Set([
    ...wearable.map(d => d.date),
    ...nights.map(s => s.log_date),
  ]);
  const sorted = Array.from(allDatesSet).sort();
  const dates = sorted.length >= 2
    ? buildDateRange(sorted[0], sorted[sorted.length - 1])
    : sorted;

  const wMap  = new Map(wearable.map(d => [d.date, d]));
  const slMap = new Map(nights.map(s => [s.log_date, s]));
  const migSet = new Set(migraineEvents.map(e => e.date));

  const days: DayData[] = dates.map(date => ({
    date,
    steps:    wMap.get(date)?.steps    ?? null,
    hrv:      wMap.get(date)?.hrv_avg  ?? null,
    sleep:    slMap.get(date)          ?? null,
    migraine: migSet.has(date),
  }));

  const N = days.length;
  const TOTAL_W = N * DAY_W;

  // Scales
  const maxSteps = Math.max(...days.map(d => d.steps ?? 0), 1);

  const hrvVals = days.map(d => d.hrv).filter((v): v is number => v != null);
  const minHRV  = hrvVals.length ? Math.min(...hrvVals) - 4 : 0;
  const maxHRV  = hrvVals.length ? Math.max(...hrvVals) + 4 : 100;
  const hcy = (v: number) =>
    H_Y + H_H - ((v - minHRV) / (maxHRV - minHRV)) * (H_H - 10) - 5;

  const maxSleep = Math.max(...days.map(d => d.sleep?.total_min ?? 0), 1);

  // HRV path — break at null values
  let hrvPath = "";
  let inSeg = false;
  days.forEach((d, i) => {
    if (d.hrv != null) {
      const x = cx(i).toFixed(1);
      const y = hcy(d.hrv).toFixed(1);
      hrvPath += inSeg ? ` L${x},${y}` : `M${x},${y}`;
      inSeg = true;
    } else {
      inSeg = false;
    }
  });

  // Snapshot numbers
  const latest     = wearable[wearable.length - 1];
  const latestSleep = nights[nights.length - 1];
  const lastHrv    = hrvVals[hrvVals.length - 1];
  const avg7       = hrvVals.slice(-7).reduce((s, v) => s + v, 0) / Math.min(7, hrvVals.length);
  const hrvTrend   = lastHrv != null ? lastHrv - avg7 : 0;

  const migCount = days.filter(d => d.migraine).length;

  return (
    <>
      <Link href="/dashboard" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">RINGCONN</h1>
      <p className="mt-1.5 font-mono text-[11px] text-ink-3">
        {N > 0 ? `${dates[0]?.slice(5)} – ${dates[N - 1]?.slice(5)} · ${N} дней` : "данные кольца"}
      </p>

      {/* ── Снапшот ── */}
      <div className="mt-4 flex overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex-1 border-r border-line px-3 py-3.5">
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3">HRV</div>
          <div className="mt-1.5 font-mono font-semibold text-[21px] leading-none text-ink">
            {lastHrv ?? "—"}<span className="text-[11px] font-normal text-ink-3"> мс</span>
          </div>
          <div className={`mt-1 font-mono text-[10px] ${hrvTrend > 0 ? "text-phase" : "text-ink-3"}`}>
            {lastHrv != null ? `${hrvTrend >= 0 ? "▲" : "▼"} ${Math.abs(hrvTrend).toFixed(0)} vs 7д` : "—"}
          </div>
        </div>
        <div className="flex-1 border-r border-line px-3 py-3.5">
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3">шаги</div>
          <div className="mt-1.5 font-mono font-semibold text-[21px] leading-none text-ink">
            {latest?.steps != null
              ? latest.steps >= 1000 ? `${(latest.steps / 1000).toFixed(1)}к` : String(latest.steps)
              : "—"}
          </div>
          <div className="mt-1 font-mono text-[10px] text-ink-3">
            {latest?.tdee_kcal != null ? `${latest.tdee_kcal} ккал` : ""}
          </div>
        </div>
        <div className="flex-1 px-3 py-3.5">
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3">сон</div>
          <div className="mt-1.5 font-mono font-semibold text-[21px] leading-none text-ink">
            {latestSleep?.total_min != null
              ? `${Math.floor(latestSleep.total_min / 60)}ч${latestSleep.total_min % 60 > 0 ? `${latestSleep.total_min % 60}м` : ""}`
              : "—"}
          </div>
          <div className="mt-1 font-mono text-[10px] text-ink-3">
            {latestSleep?.quality_pct != null ? `${latestSleep.quality_pct}% кач` : ""}
          </div>
        </div>
      </div>

      {/* ── Объединённый чарт ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        {/* Header + legend */}
        <div className="flex items-start justify-between">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            шаги · HRV · сон × мигрень
          </p>
          {migCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[9px] text-ink-3">
              <span className="inline-block h-[8px] w-[8px] rounded-full" style={{ background: MIG }} />
              {migCount} мигрен{migCount === 1 ? "ь" : "и"}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {[
            ["шаги", 0.55],
            ["HRV (линия)", 1],
            ["сон глуб.", 1],
            ["сон лёгк.", 0.32],
          ].map(([label, op]) => (
            <span key={label as string} className="flex items-center gap-1 font-mono text-[8px] text-ink-4">
              <span
                className="inline-block h-[8px] w-[8px] rounded-[1px]"
                style={{ background: "var(--phase)", opacity: op as number }}
              />
              {label as string}
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div className="relative mt-3">
          {/* Gradient scroll hint */}
          <div
            className="pointer-events-none absolute right-0 top-0 z-10 w-6"
            style={{
              bottom: 0,
              background: "linear-gradient(to right, transparent, var(--surface))",
            }}
          />

          <div className="flex">
            {/* Fixed left labels */}
            <svg
              width={LABEL_W}
              height={TOTAL_H}
              style={{ flexShrink: 0, display: "block" }}
            >
              {/* Steps label */}
              <text
                x={LABEL_W / 2}
                y={S_Y + S_H / 2 + 3}
                textAnchor="middle"
                fill={LABEL_C}
                fontSize={7}
                fontFamily="monospace"
                transform={`rotate(-90,${LABEL_W / 2},${S_Y + S_H / 2})`}
              >ШАГ</text>
              <line x1={LABEL_W - 0.5} y1={S_Y} x2={LABEL_W - 0.5} y2={S_Y + S_H} stroke={DIVIDER} strokeWidth={1} />

              {/* HRV label */}
              <text
                x={LABEL_W / 2}
                y={H_Y + H_H / 2 + 3}
                textAnchor="middle"
                fill={LABEL_C}
                fontSize={7}
                fontFamily="monospace"
                transform={`rotate(-90,${LABEL_W / 2},${H_Y + H_H / 2})`}
              >HRV</text>
              <line x1={LABEL_W - 0.5} y1={H_Y} x2={LABEL_W - 0.5} y2={H_Y + H_H} stroke={DIVIDER} strokeWidth={1} />

              {/* Sleep label */}
              <text
                x={LABEL_W / 2}
                y={SL_Y + SL_H / 2 + 3}
                textAnchor="middle"
                fill={LABEL_C}
                fontSize={7}
                fontFamily="monospace"
                transform={`rotate(-90,${LABEL_W / 2},${SL_Y + SL_H / 2})`}
              >СОН</text>
              <line x1={LABEL_W - 0.5} y1={SL_Y} x2={LABEL_W - 0.5} y2={SL_Y + SL_H} stroke={DIVIDER} strokeWidth={1} />

              {/* Migraine dot placeholder */}
              <circle cx={LABEL_W / 2} cy={DOT_Y} r="3" fill={MIG} />
            </svg>

            {/* Scrollable data */}
            <div style={{ flex: 1, overflowX: "auto" }}>
              <svg
                width={TOTAL_W}
                height={TOTAL_H}
                style={{ display: "block", minWidth: TOTAL_W }}
              >
                {/* Section dividers */}
                <line x1={0} y1={S_Y}  x2={TOTAL_W} y2={S_Y}  stroke={DIVIDER} strokeWidth={0.5} />
                <line x1={0} y1={H_Y}  x2={TOTAL_W} y2={H_Y}  stroke={DIVIDER} strokeWidth={0.5} />
                <line x1={0} y1={SL_Y} x2={TOTAL_W} y2={SL_Y} stroke={DIVIDER} strokeWidth={0.5} />

                {/* ── Migraine column highlights ── */}
                {days.map((d, i) =>
                  d.migraine ? (
                    <rect
                      key={`mg-bg-${i}`}
                      x={i * DAY_W}
                      y={0}
                      width={DAY_W}
                      height={DATE_Y}
                      fill="rgba(208,72,48,0.12)"
                    />
                  ) : null
                )}

                {/* ── Steps bars ── */}
                {days.map((d, i) => {
                  if (d.steps == null) return null;
                  const h = Math.max(1, (d.steps / maxSteps) * (S_H - 5));
                  return (
                    <rect
                      key={`st-${i}`}
                      x={i * DAY_W + 2}
                      y={S_Y + S_H - h}
                      width={DAY_W - 4}
                      height={h}
                      fill="var(--phase)"
                      fillOpacity="0.55"
                      rx="1"
                    />
                  );
                })}

                {/* ── HRV line ── */}
                {hrvPath && (
                  <path
                    d={hrvPath}
                    fill="none"
                    stroke="var(--phase)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {days.map((d, i) =>
                  d.hrv != null ? (
                    <circle
                      key={`hd-${i}`}
                      cx={cx(i)}
                      cy={hcy(d.hrv)}
                      r="2.5"
                      fill="var(--phase)"
                    />
                  ) : null
                )}

                {/* ── Sleep stacked bars ── */}
                {days.map((d, i) => {
                  if (!d.sleep) return null;
                  const s  = d.sleep;
                  const tot = s.total_min ?? 1;
                  const bH  = (tot / maxSleep) * (SL_H - 5);
                  const bx  = i * DAY_W + 2;
                  const bw  = DAY_W - 4;
                  const bot = SL_Y + SL_H - 2;

                  const dH = ((s.deep_min  ?? 0) / tot) * bH;
                  const rH = ((s.rem_min   ?? 0) / tot) * bH;
                  const lH = ((s.light_min ?? 0) / tot) * bH;
                  const aH = Math.max(0, bH - dH - rH - lH);

                  return (
                    <g key={`sl-${i}`}>
                      {dH > 0 && <rect x={bx} y={bot - dH}             width={bw} height={dH} fill="var(--phase)" fillOpacity="1"    />}
                      {rH > 0 && <rect x={bx} y={bot - dH - rH}        width={bw} height={rH} fill="var(--phase)" fillOpacity="0.65"  />}
                      {lH > 0 && <rect x={bx} y={bot - dH - rH - lH}   width={bw} height={lH} fill="var(--phase)" fillOpacity="0.32"  />}
                      {aH > 0 && <rect x={bx} y={bot - dH - rH - lH - aH} width={bw} height={aH} fill="var(--phase)" fillOpacity="0.1" rx={1} />}
                    </g>
                  );
                })}

                {/* ── Date labels + migraine dots ── */}
                {days.map((d, i) => (
                  <g key={`dt-${i}`}>
                    {i % 3 === 0 && (
                      <text
                        x={cx(i)}
                        y={DATE_Y + 11}
                        textAnchor="middle"
                        fill={LABEL_C}
                        fontSize={7}
                        fontFamily="monospace"
                      >
                        {d.date.slice(5)}
                      </text>
                    )}
                    {d.migraine && (
                      <circle cx={cx(i)} cy={DOT_Y} r="3.5" fill={MIG} />
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        <p className="mt-1 text-right font-mono text-[9px] text-ink-4">← прокрути</p>

        <p className="mt-2 font-sans text-[11.5px] leading-[1.55] text-ink-2">
          {migCount > 0
            ? "Красная подсветка = день мигрени. Смотри: падает ли HRV за 1–2 дня до атаки, как выглядит сон накануне."
            : "За период мигреней не зафиксировано — хорошо. Данные накапливаются."}
        </p>
      </section>

      {/* ── Витальные ── */}
      {latest && (
        <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            витальные · {latest.date}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">ЧСС покоя</div>
              <div className="mt-1.5 font-mono font-semibold text-[22px] leading-none text-ink">{latest.hr_resting ?? "—"}</div>
              <div className="mt-0.5 font-mono text-[9px] text-ink-4">уд/мин</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">SpO₂</div>
              <div className="mt-1.5 font-mono font-semibold text-[22px] leading-none text-ink">{latest.spo2_avg ?? "—"}</div>
              <div className="mt-0.5 font-mono text-[9px] text-ink-4">%</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">TDEE</div>
              <div className="mt-1.5 font-mono font-semibold text-[22px] leading-none text-ink">{latest.tdee_kcal ?? "—"}</div>
              <div className="mt-0.5 font-mono text-[9px] text-ink-4">ккал/д</div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
