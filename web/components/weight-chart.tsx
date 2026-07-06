"use client";

import { useRef, useState, useEffect } from "react";
import { parseDate, daysBetween } from "@/lib/cycle";
import type { WeightRow, CalorieEntry } from "@/lib/data";

const RU_MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const ML = 28, MR = 26, H = 200, Y0 = 12, Y1 = 175;

// Дефицит/профицит калорий: цвет столбика зависит от того, насколько день
// отклонился от точки баланса (TDEE) — не просто "выше/ниже", а с
// нарастающей интенсивностью. Отклонение свыше 25% от точки баланса даёт
// полностью насыщенный цвет; ближе к балансу — нейтральный серый.
function kcalBarColor(kcal: number, balanceKcal: number | null | undefined): string {
  if (!balanceKcal) return "var(--phase)";
  const dev = (kcal - balanceKcal) / balanceKcal;
  const t = Math.min(Math.abs(dev) / 0.25, 1);
  const base = dev < 0 ? "var(--deficit)" : "var(--warn)";
  return `color-mix(in oklab, ${base} ${Math.round(t * 100)}%, var(--surface-3))`;
}

export function WeightChart({
  rows,
  goalKg,
  goalDateISO,
  todayISO,
  calories,
  calorieBalanceKcal,
  calorieGoalKcal,
  showTargets = true,
}: {
  rows: WeightRow[];
  goalKg: number;
  goalDateISO: string;
  todayISO: string;
  calories?: CalorieEntry[];
  calorieBalanceKcal?: number | null;
  calorieGoalKcal?: number | null;
  // false = режим "только наблюдение" (беременность): без линии цели,
  // плана и оценочной подсветки — голый факт веса и калорий.
  showTargets?: boolean;
}) {
  const [pxPerDay, _setPx] = useState(7);
  const pxRef = useRef(7);
  const containerRef = useRef<HTMLDivElement>(null);

  function zoom(factor: number) {
    const el = containerRef.current;
    const old = pxRef.current;
    const next = Math.max(1.5, Math.min(30, old * factor));
    if (Math.abs(next - old) < 0.05) return;
    const viewW = el?.clientWidth ?? 0;
    const centerDays = el ? (el.scrollLeft + viewW / 2 - ML) / old : 0;
    pxRef.current = next;
    _setPx(next);
    if (el) requestAnimationFrame(() => { el.scrollLeft = ML + centerDays * next - viewW / 2; });
  }

  // Non-passive touchmove to handle pinch-zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let sd: number | null = null, sp = 7;
    const d = (e: TouchEvent) => Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
    const onS = (e: TouchEvent) => { if (e.touches.length === 2) { sd = d(e); sp = pxRef.current; } };
    const onM = (e: TouchEvent) => {
      if (e.touches.length !== 2 || sd === null) return;
      e.preventDefault();
      const dist = d(e);
      const next = Math.max(1.5, Math.min(30, sp * (dist / sd)));
      const old = pxRef.current;
      if (Math.abs(next - old) < 0.05) return;
      const viewW = el.clientWidth;
      const centerDays = (el.scrollLeft + viewW / 2 - ML) / old;
      pxRef.current = next;
      _setPx(next);
      requestAnimationFrame(() => { el.scrollLeft = ML + centerDays * next - viewW / 2; });
    };
    const onE = () => { sd = null; };
    el.addEventListener("touchstart", onS, { passive: true });
    el.addEventListener("touchmove", onM, { passive: false });
    el.addEventListener("touchend", onE);
    return () => {
      el.removeEventListener("touchstart", onS);
      el.removeEventListener("touchmove", onM);
      el.removeEventListener("touchend", onE);
    };
  }, []);

  // Scroll to today on mount (70% from left)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !rows.length) return;
    const times = rows.map((r) => parseDate(r.date).getTime());
    const minD = new Date(Math.min(...times));
    const todayX = ML + daysBetween(minD, parseDate(todayISO)) * pxRef.current;
    el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.7);
  }, [rows, todayISO]);

  if (!rows.length) return null;

  const plan   = showTargets ? rows.filter((r) => r.plan != null).map((r) => ({ date: r.date, kg: r.plan as number })) : [];
  const actual = rows.filter((r) => r.actual != null).map((r) => ({ date: r.date, kg: r.actual as number }));

  const times = rows.map((r) => parseDate(r.date).getTime());
  const minD  = new Date(Math.min(...times));
  const goalD = parseDate(goalDateISO);
  const maxD  = showTargets && goalD.getTime() > Math.max(...times) ? goalD : new Date(Math.max(...times));
  const span  = Math.max(1, daysBetween(minD, maxD));
  const W     = ML + Math.ceil(span * pxPerDay) + MR;

  const X = (iso: string) => ML + daysBetween(minD, parseDate(iso)) * pxPerDay;
  const kgs = [...plan, ...actual].map((p) => p.kg).concat(showTargets ? [goalKg] : []);
  const minKg = Math.floor(Math.min(...kgs) - 1);
  const maxKg = Math.ceil(Math.max(...kgs) + 1);
  const Y = (kg: number) => Y0 + ((maxKg - kg) / (maxKg - minKg)) * (Y1 - Y0);
  const pts = (arr: { date: string; kg: number }[]) =>
    arr.map((p) => `${X(p.date).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(" ");

  const todayX = X(todayISO);
  const step   = Math.max(1, Math.round((maxKg - minKg) / 4));
  const ticks: number[] = [];
  for (let k = minKg; k <= maxKg; k += step) ticks.push(k);

  // Month label positions
  const months: { x: number; label: string }[] = [];
  const mc = new Date(minD.getFullYear(), minD.getMonth(), 1);
  while (mc.getTime() <= maxD.getTime()) {
    const iso = `${mc.getFullYear()}-${String(mc.getMonth() + 1).padStart(2, "0")}-01`;
    months.push({ x: X(iso), label: RU_MON[mc.getMonth()] });
    mc.setMonth(mc.getMonth() + 1);
  }

  // Calorie bars
  const cal     = calories ?? [];
  const kcalRefs = [calorieBalanceKcal, calorieGoalKcal].filter((v): v is number => !!v);
  const maxKcal = cal.length || kcalRefs.length
    ? Math.max(...cal.map((c) => c.kcal), ...kcalRefs, 1800)
    : 2000;
  const barW    = Math.max(2.5, pxPerDay * 0.8);
  const Yk      = (kcal: number) => Y1 - (kcal / maxKcal) * (Y1 - Y0);
  const kcalTicks = [500, 1000, 1500, 2000].filter((v) => v <= maxKcal + 200);

  const btnCls = "flex h-6 w-6 items-center justify-center rounded-[3px] border border-line bg-surface font-mono text-[13px] leading-none text-ink-2 transition active:scale-90";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-end gap-1">
        <button type="button" className={btnCls} onClick={() => zoom(1 / 1.5)} aria-label="Уменьшить">−</button>
        <button type="button" className={btnCls} onClick={() => zoom(1.5)} aria-label="Увеличить">+</button>
      </div>

      <div
        ref={containerRef}
        className="overflow-x-auto"
        style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ color: "var(--ink-3)", display: "block" }}
        >
          {/* Kcal bars — цвет = дефицит (зелёный) / профицит (красный) относительно точки баланса */}
          {cal.map((c) => {
            const bx = X(c.date);
            const top = Yk(c.kcal);
            return (
              <rect key={c.date} x={bx - barW / 2} y={top} width={barW}
                height={Y1 - top} fill={kcalBarColor(c.kcal, calorieBalanceKcal)}
                opacity={calorieBalanceKcal ? "0.8" : "0.15"} rx="1">
                <title>{`${c.date} — ${c.kcal} ккал`}</title>
              </rect>
            );
          })}

          {/* Calorie balance point (TDEE) — нейтральный ориентир */}
          {calorieBalanceKcal != null && (
            <>
              <line x1={ML} y1={Yk(calorieBalanceKcal)} x2={W - MR} y2={Yk(calorieBalanceKcal)}
                stroke="var(--ink-3)" strokeDasharray="2 3" opacity="0.5" />
              <text x={ML + 2} y={Yk(calorieBalanceKcal) - 3} fontSize="8" fill="var(--ink-3)">
                баланс {calorieBalanceKcal}
              </text>
            </>
          )}

          {/* Calorie goal — целевой уровень потребления */}
          {calorieGoalKcal != null && (
            <>
              <line x1={ML} y1={Yk(calorieGoalKcal)} x2={W - MR} y2={Yk(calorieGoalKcal)}
                stroke="var(--deficit)" strokeDasharray="4 2" opacity="0.6" />
              <text x={ML + 2} y={Yk(calorieGoalKcal) - 3} fontSize="8" fill="var(--deficit)">
                цель {calorieGoalKcal}
              </text>
            </>
          )}

          {/* Weight grid */}
          {ticks.map((k) => (
            <g key={k}>
              <line x1={ML} y1={Y(k)} x2={W - MR} y2={Y(k)} stroke="var(--line)" />
              <text x={ML - 4} y={Y(k)} textAnchor="end" dominantBaseline="middle"
                fontSize="9" fill="currentColor" opacity="0.7">{k}</text>
            </g>
          ))}

          {/* Month dividers + labels */}
          {months.map(({ x, label }) => x >= ML && x <= W - MR ? (
            <g key={`m-${label}-${x}`}>
              <line x1={x} y1={Y0} x2={x} y2={Y1} stroke="var(--line)" strokeDasharray="1 4" opacity="0.5" />
              <text x={x} y={H - 3} textAnchor="middle" fontSize="8"
                fill="currentColor" opacity="0.5">{label}</text>
            </g>
          ) : null)}

          {/* Kcal right axis */}
          {cal.length > 0 && kcalTicks.map((v) => (
            <text key={v} x={W - MR + 3} y={Yk(v)} dominantBaseline="middle"
              fontSize="7.5" fill="var(--phase)" opacity="0.55">
              {v >= 1000 ? `${v / 1000}k` : v}
            </text>
          ))}

          {/* Goal line */}
          {showTargets && (
            <>
              <line x1={ML} y1={Y(goalKg)} x2={W - MR} y2={Y(goalKg)}
                stroke="var(--phase)" strokeDasharray="3 3" opacity="0.65" />
              <text x={W - MR} y={Y(goalKg) - 4} textAnchor="end" fontSize="9" fill="var(--phase)">
                цель {goalKg}
              </text>
            </>
          )}

          {/* Today line */}
          {todayX >= ML && todayX <= W - MR && (
            <line x1={todayX} y1={Y0} x2={todayX} y2={Y1}
              stroke="currentColor" strokeDasharray="2 3" opacity="0.4" />
          )}

          {/* Weight lines */}
          <polyline points={pts(plan)} fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
          <polyline points={pts(actual)} fill="none" stroke="var(--phase)"
            strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {actual.map((p) => (
            <circle key={p.date} cx={X(p.date)} cy={Y(p.kg)} r="2.5" fill="var(--phase)" />
          ))}
        </svg>
      </div>
    </div>
  );
}
