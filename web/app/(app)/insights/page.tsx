import Link from "next/link";
import { getPeriodStarts, getMigraineEventsSince, getAllMigraineEvents, getCycleHistory } from "@/lib/data";
import { allMonthlyBars, perimenstrualStats, buildCycleCalendar } from "@/lib/insights";
import { MigraineChart } from "./migraine-chart";
import { CycleHistoryChart } from "./cycle-history";

export const dynamic = "force-dynamic";

const MIG = "#d85a30";
const MENS = "rgba(177,74,99,0.22)";

export default async function Insights() {
  const today = new Date();
  const since = `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [starts, recentEvents, allEvents, cycleHistory] = await Promise.all([
    getPeriodStarts(),
    getMigraineEventsSince(since),
    getAllMigraineEvents(),
    getCycleHistory(),
  ]);

  const peri = perimenstrualStats(recentEvents, starts);
  const chartBars = allMonthlyBars(allEvents);
  const cycles = buildCycleCalendar(starts, recentEvents, today, 6);

  return (
    <>
      {/* ── Шапка ── */}
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">МИГРЕНЬ</h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">наблюдения по твоим записям</p>

      {/* ── Дисклеймер ── */}
      <div className="mt-4 rounded-card border border-line bg-surface-2 px-3.5 py-2.5 font-sans text-[11.5px] leading-relaxed text-ink-2">
        Это наблюдения по твоим логам, а не диагноз. Решения — с лечащим неврологом.
      </div>

      {/* ── Поделиться с неврологом ── */}
      <Link
        href="/insights/report"
        className="mt-3 flex items-center justify-between rounded-card border border-line bg-surface px-3.5 py-3 font-mono text-[11px] tracking-[0.1em] uppercase text-ink-2 active:scale-[0.99]"
      >
        <span>печать / для невролога</span>
        <span className="text-phase">→</span>
      </Link>

      {/* ── Связь с циклом ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-5">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          связь с циклом
        </p>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="font-mono text-[46px] font-semibold leading-[0.9] text-phase">
            {peri.pct}%
          </span>
          <span className="font-sans text-[12.5px] text-ink-2">
            атак в окне<br />−2…+3 от месячных
          </span>
        </div>
        <p className="mt-3 font-sans text-[12.5px] leading-[1.55] text-ink-2">
          Похоже на{" "}
          <b className="font-semibold text-ink">менструально-ассоциированную</b> мигрень.
          За 12 мес: {peri.peri} из {peri.total} приступов жмутся к месячным.
        </p>
      </section>

      {/* ── Приступы по месяцам ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          приступы по месяцам
        </p>
        <div className="mt-4">
          <MigraineChart bars={chartBars} />
        </div>
        <p className="mt-3 font-sans text-[12px] leading-[1.55] text-ink-2">
          Порог медикаментозной ГБ — <b className="font-semibold text-ink">10 дней/мес</b>.
          Держишься ниже, но часто близко. Регулярный приём — повод обсудить{" "}
          <b className="font-semibold text-ink">профилактику</b>.
        </p>
      </section>

      {/* ── Мигрень × цикл ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          мигрень × цикл
        </p>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[11px] w-[11px] rounded-[2px]" style={{ background: MENS }} />
            менструация
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[11px] w-[11px] rounded-[2px]" style={{ background: MIG }} />
            мигрень
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-1">
          {cycles.map((cy, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right font-mono text-[9px] text-ink-3">
                {cy.label}
              </span>
              <div
                className="flex-1"
                style={{ display: "grid", gridTemplateColumns: "repeat(35, 1fr)", gap: "2px" }}
              >
                {cy.days.map((d) => (
                  <span
                    key={d.day}
                    title={`день ${d.day}`}
                    className="h-[11px] rounded-[1px]"
                    style={{
                      background: d.migraine ? MIG : d.menstrual ? MENS : "var(--surface-3)",
                      outline: d.isToday ? "2px solid var(--phase)" : "none",
                      outlineOffset: "-2px",
                    }}
                  />
                ))}
                {Array.from({ length: 35 - cy.days.length }, (_, j) => (
                  <span key={`pad-${j}`} className="h-[11px] rounded-[1px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Вся история: цикл × мигрень ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          история 2018–2026
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: "rgba(196,80,110,0.18)" }} />
            менструация
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#d04830" }} />
            мигрень
          </span>
        </div>
        <p className="mt-1 font-mono text-[9px] text-ink-4">
          каждая строка — один цикл · X = день цикла · прокрути вниз
        </p>
        <div className="mt-2.5">
          <CycleHistoryChart rows={cycleHistory} />
        </div>
      </section>

      {/* ── Когда к врачу ── */}
      <details className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <summary className="cursor-pointer font-sans text-[14px] font-semibold text-ink">
          Когда срочно к врачу
        </summary>
        <ul className="mt-2.5 space-y-1.5 font-sans text-[12.5px] leading-relaxed text-ink-2">
          <li>Внезапная очень сильная «громоподобная» боль — худшая в жизни.</li>
          <li>Впервые возникшая аура, либо необычно долгая / со слабостью или речью.</li>
          <li>Онемение, слабость в руке или ноге, асимметрия лица.</li>
          <li>Боль после травмы головы; температура с ригидностью шеи.</li>
          <li>Резкое учащение или смена характера приступов.</li>
        </ul>
        <p className="mt-2.5 font-mono text-[11px] text-ink-3">
          Приложение не ставит диагнозов — это сигналы обратиться к врачу или в неотложку.
        </p>
      </details>
    </>
  );
}
