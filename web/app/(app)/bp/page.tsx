import Link from "next/link";
import { getBpReadings, type BpReading } from "@/lib/data";
import { getCurrentUser, isPregnant } from "@/lib/auth";
import { todayISOMoscow, isoDaysFromTodayMoscow } from "@/lib/format";
import { BpTracker } from "./bp-tracker";

export const dynamic = "force-dynamic";

const RU_MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function daysBetweenISO(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

// ── Тренд за 30 дней: точки систолического и диастолического ────────────────
// Никаких «зон нормы» и цветовых шкал (вето Елены) — только значения и
// нейтральная сетка.
function BpChart({ readings, fromISO, toISO }: { readings: BpReading[]; fromISO: string; toISO: string }) {
  const inWindow = readings.filter((r) => r.date >= fromISO && r.date <= toISO);
  if (inWindow.length < 2) return null;

  const ML = 30, MR = 8, W = 348, Y0 = 14, Y1 = 108, H = 128;
  const span = Math.max(1, daysBetweenISO(fromISO, toISO));
  const X = (r: BpReading) =>
    ML + (daysBetweenISO(fromISO, r.date) + (r.slot === "evening" ? 0.35 : 0)) * ((W - ML - MR) / span);

  const vals = inWindow.flatMap((r) => [r.systolic, r.diastolic]);
  const minV = Math.floor((Math.min(...vals) - 8) / 10) * 10;
  const maxV = Math.ceil((Math.max(...vals) + 8) / 10) * 10;
  const Y = (v: number) => Y0 + ((maxV - v) / Math.max(1, maxV - minV)) * (Y1 - Y0);

  const ticks: number[] = [];
  const step = maxV - minV > 80 ? 40 : 20;
  for (let t = minV; t <= maxV; t += step) ticks.push(t);

  const months: { x: number; label: string }[] = [];
  let cur = fromISO;
  while (cur <= toISO) {
    if (cur.slice(8) === "01" || cur === fromISO) {
      months.push({
        x: ML + daysBetweenISO(fromISO, cur) * ((W - ML - MR) / span),
        label: RU_MON[parseInt(cur.slice(5, 7)) - 1],
      });
    }
    cur = new Date(new Date(cur + "T12:00:00").getTime() + 86400000).toISOString().slice(0, 10);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ color: "var(--ink-3)" }}
      role="img" aria-label="Точки артериального давления за 30 дней">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={ML} y1={Y(t)} x2={W - MR} y2={Y(t)} stroke="var(--line)" />
          <text x={ML - 4} y={Y(t)} textAnchor="end" dominantBaseline="middle"
            fontSize="8" fill="currentColor" opacity="0.7">{t}</text>
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
        <text key={`${label}-${i}`} x={x} y={H - 4} fontSize="8"
          fill="currentColor" opacity="0.6">{label}</text>
      ))}
    </svg>
  );
}

export default async function BpPage() {
  const todayISO = todayISOMoscow();
  const [readings, user] = await Promise.all([
    getBpReadings(isoDaysFromTodayMoscow(-90)),
    getCurrentUser(),
  ]);
  const pregnant = isPregnant(user);
  const chartFrom = isoDaysFromTodayMoscow(-30);

  return (
    <>
      <Link href="/dashboard" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">ДАВЛЕНИЕ</h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">
        артериальное · утро и вечер · дневник для врача
      </p>

      <BpTracker readings={readings} todayISO={todayISO} pregnant={pregnant} />

      {readings.filter((r) => r.date >= chartFrom).length >= 2 && (
        <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            тренд · 30 дней
          </p>
          <div className="mt-3">
            <BpChart readings={readings} fromISO={chartFrom} toISO={todayISO} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[10px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--ink)" }} /> верхнее
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--ink-3)" }} /> нижнее
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ borderColor: "var(--ink-2)" }} /> вечер (контур)
            </span>
          </div>
        </section>
      )}

      <p className="mt-3 font-sans text-[11.5px] leading-relaxed text-ink-3">
        VERTA не ставит диагнозы. Это дневник наблюдений для тебя и твоего врача.
      </p>
    </>
  );
}
