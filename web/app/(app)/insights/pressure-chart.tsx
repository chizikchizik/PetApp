"use client";

import { useWidth } from "@/components/use-width";

const RU_MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

// Линия давления + отметки дней мигрени. Рисуется в реальную ширину
// контейнера: подписи 11 px на любом экране.
export function PressureChart({
  pressure,
  attackDates,
  matchedDates,
  fromISO,
  toISO,
}: {
  pressure: { date: string; hpa: number }[];
  attackDates: string[];
  matchedDates: string[];
  fromISO: string;
  toISO: string;
}) {
  const [ref, measured] = useWidth();
  const W = measured ?? 312;
  const ML = 36, MR = 6, Y0 = 10, Y1 = 98, H = 132;
  const span = Math.max(1, daysBetweenISO(fromISO, toISO));
  const step = (W - ML - MR) / span;
  const X = (iso: string) => ML + daysBetweenISO(fromISO, iso) * step;
  const matched = new Set(matchedDates);

  const inWindow = pressure.filter((p) => p.date >= fromISO && p.date <= toISO);
  const vals = inWindow.map((p) => p.hpa);
  const minV = Math.floor(Math.min(...vals)) - 2;
  const maxV = Math.ceil(Math.max(...vals)) + 2;
  const Y = (hpa: number) => Y0 + ((maxV - hpa) / Math.max(1, maxV - minV)) * (Y1 - Y0);
  const gridTicks = [maxV - 2, Math.round((maxV + minV) / 2), minV + 2];

  const pts = inWindow.map((p) => `${X(p.date).toFixed(1)},${Y(p.hpa).toFixed(1)}`).join(" ");
  const attacks = [...new Set(attackDates)].filter((d) => d >= fromISO && d <= toISO);

  // Подпись месяца — только если до предыдущей хватает места (≈ 28 px);
  // неполный первый месяц окна уступает место началу следующего.
  const months: { x: number; label: string }[] = [];
  let firstPartial = false;
  let cur = fromISO;
  while (cur <= toISO) {
    if (cur.slice(8) === "01" || cur === fromISO) {
      const m = { x: X(cur), label: RU_MON[parseInt(cur.slice(5, 7)) - 1] };
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
        role="img" aria-label="Линия атмосферного давления с отметками дней мигрени">
        {gridTicks.map((t) => (
          <g key={t}>
            <line x1={ML} y1={Y(t)} x2={W - MR} y2={Y(t)} stroke="var(--line)" />
            <text x={ML - 4} y={Y(t)} textAnchor="end" dominantBaseline="middle"
              fontSize="11" fill="var(--ink-3)">{t}</text>
          </g>
        ))}

        {attacks.map((d) => matched.has(d) && (
          <rect key={`hl-${d}`} x={X(addDaysISO(d, -2))} y={Y0}
            width={Math.max(3, step * 2)} height={Y1 - Y0} fill="var(--warn)" opacity="0.12" />
        ))}

        {attacks.map((d) => (
          <line key={`v-${d}`} x1={X(d)} y1={Y0} x2={X(d)} y2={Y1}
            stroke="var(--warn)" strokeDasharray="2 3" opacity="0.3" />
        ))}

        {inWindow.length > 1 && (
          <polyline points={pts} fill="none" stroke="var(--ink-2)"
            strokeWidth="1.6" strokeLinejoin="round" />
        )}

        {attacks.map((d) => (
          <line key={`t-${d}`} x1={X(d)} y1={Y1 + 5} x2={X(d)} y2={Y1 + 13}
            stroke="var(--warn)" strokeWidth="2.5" />
        ))}

        {months.map(({ x, label }, i) => (
          <text key={`${label}-${i}`} x={x} y={H - 3} fontSize="11" fill="var(--ink-3)">{label}</text>
        ))}
      </svg>
    </div>
  );
}
