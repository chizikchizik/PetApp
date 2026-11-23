"use client";

import { useWidth } from "@/components/use-width";

const RU_MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

type Point = { date: string; slot: string; systolic: number; diastolic: number };

function daysBetweenISO(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

// Тренд за 30 дней: точки систолического и диастолического. Никаких «зон
// нормы» и цветовых шкал (вето Елены) — только значения и нейтральная сетка.
// Рисуется в реальную ширину контейнера: подписи 11 px на любом экране.
export function BpChart({ readings, fromISO, toISO }: { readings: Point[]; fromISO: string; toISO: string }) {
  const [ref, measured] = useWidth();
  const inWindow = readings.filter((r) => r.date >= fromISO && r.date <= toISO);
  if (inWindow.length < 2) return null;

  const W = measured ?? 312;
  const ML = 32, MR = 8, Y0 = 10, Y1 = 108, H = 128;
  const span = Math.max(1, daysBetweenISO(fromISO, toISO));
  const dayW = (W - ML - MR) / span;
  const X = (r: Point) => ML + (daysBetweenISO(fromISO, r.date) + (r.slot === "evening" ? 0.35 : 0)) * dayW;

  const vals = inWindow.flatMap((r) => [r.systolic, r.diastolic]);
  const minV = Math.floor((Math.min(...vals) - 8) / 10) * 10;
  const maxV = Math.ceil((Math.max(...vals) + 8) / 10) * 10;
  const Y = (v: number) => Y0 + ((maxV - v) / Math.max(1, maxV - minV)) * (Y1 - Y0);

  const ticks: number[] = [];
  const step = maxV - minV > 80 ? 40 : 20;
  for (let t = minV; t <= maxV; t += step) ticks.push(t);

  // Подпись месяца — только если до предыдущей хватает места (≈ 28 px);
  // неполный первый месяц окна уступает место началу следующего.
  const months: { x: number; label: string }[] = [];
  let firstPartial = false;
  let cur = fromISO;
  while (cur <= toISO) {
    if (cur.slice(8) === "01" || cur === fromISO) {
      const m = { x: ML + daysBetweenISO(fromISO, cur) * dayW, label: RU_MON[parseInt(cur.slice(5, 7)) - 1] };
      const prev = months[months.length - 1];
      if (!prev) {
        months.push(m);
        firstPartial = cur.slice(8) !== "01";
      } else if (m.x - prev.x >= 28) {
        months.push(m);
      } else if (months.length === 1 && firstPartial) {
        months[0] = m;
        firstPartial = false;
      }
    }
    cur = new Date(new Date(cur + "T12:00:00").getTime() + 86400000).toISOString().slice(0, 10);
  }

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block"
        role="img" aria-label="Точки артериального давления за 30 дней">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} y1={Y(t)} x2={W - MR} y2={Y(t)} stroke="var(--line)" />
            <text x={ML - 4} y={Y(t)} textAnchor="end" dominantBaseline="middle"
              fontSize="11" fill="var(--ink-3)">{t}</text>
          </g>
        ))}
        {inWindow.map((r) => (
          <g key={`${r.date}-${r.slot}`}>
            <circle cx={X(r)} cy={Y(r.systolic)} r="3"
              fill={r.slot === "morning" ? "var(--ink)" : "none"}
              stroke="var(--ink)" strokeWidth="1.5" />
            <circle cx={X(r)} cy={Y(r.diastolic)} r="3"
              fill={r.slot === "morning" ? "var(--ink-3)" : "none"}
              stroke="var(--ink-3)" strokeWidth="1.5" />
          </g>
        ))}
        {months.map(({ x, label }, i) => (
          <text key={`${label}-${i}`} x={x} y={H - 3} fontSize="11" fill="var(--ink-3)">{label}</text>
        ))}
      </svg>
    </div>
  );
}
