import Link from "next/link";
import { getPeriodStarts, getWeightEntries, getCurrentWeight, getCalorieEntries, WEIGHT_GOAL } from "@/lib/data";
import { getCurrentCycle, PHASE_LABELS, type Phase } from "@/lib/cycle";
import { todayISOMoscow } from "@/lib/format";
import { WeightChart } from "@/components/weight-chart";
import { WeightInput } from "./weight-input";
import { CalorieInput } from "./calorie-input";

export const dynamic = "force-dynamic";

const PHASE_NOTE: Record<Phase, string> = {
  menstrual: "Менструация: вес может быть выше из-за задержки воды — это уйдёт.",
  follicular: "Фолликулярная фаза: вес сейчас наиболее показателен. Минимум задержки воды.",
  ovulatory: "Овуляция: возможна лёгкая задержка воды.",
  luteal: "Лютеиновая фаза: задержка воды может прибавить +0.5–1.5 кг. Это не жир — не пугайся весов.",
};

export default async function Weight() {
  const dayKey = todayISOMoscow();
  const today = new Date(dayKey + "T12:00:00");
  const [starts, rows, current, calories] = await Promise.all([
    getPeriodStarts(),
    getWeightEntries(),
    getCurrentWeight(),
    getCalorieEntries(),
  ]);
  const c = getCurrentCycle(starts, today);
  const fromStart = +(current - WEIGHT_GOAL.startKg).toFixed(1);
  const toGoal = +(current - WEIGHT_GOAL.kg).toFixed(1);

  return (
    <>
      {/* ── Шапка ── */}
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">ВЕС</h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">
        план и факт · цель {WEIGHT_GOAL.kg} кг
      </p>

      {/* ── Текущий вес ── */}
      <section className="mt-4 flex items-end justify-between rounded-card border border-line bg-surface p-5">
        <div>
          <div className="font-mono text-[46px] font-semibold leading-[0.9] text-ink">
            {current}
          </div>
          <div className="mt-1.5 font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3">
            кг сегодня
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-semibold text-[15px] text-phase">
            {fromStart} кг
          </div>
          <div className="mt-1 font-mono text-[10px] text-ink-2">от старта {WEIGHT_GOAL.startKg}</div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-2">
            до цели {toGoal > 0 ? `−${toGoal}` : toGoal} кг
          </div>
        </div>
      </section>

      {/* ── График ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-phase" /> вес (факт)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-ink-3" /> план
          </span>
          {calories.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-4 rounded-[1px] bg-phase opacity-30" /> ккал
            </span>
          )}
        </div>
        <div className="mt-3">
          <WeightChart
            rows={rows}
            goalKg={WEIGHT_GOAL.kg}
            goalDateISO={WEIGHT_GOAL.dateISO}
            todayISO={dayKey}
            calories={calories}
          />
        </div>
      </section>

      {/* ── Инсайт фазы ── */}
      <section
        className="mt-3.5 rounded-card border border-line bg-surface p-4"
        style={{ borderLeft: "3px solid var(--phase)" }}
      >
        <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-phase">
          {PHASE_LABELS[c.phase]} · день {c.day}
        </div>
        <p className="mt-2 font-sans text-[12.5px] leading-[1.55] text-ink-2">
          {PHASE_NOTE[c.phase]}
        </p>
      </section>

      {/* ── Записать вес ── */}
      <div className="mt-3.5">
        <p className="mb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          записать вес
        </p>
        <WeightInput dayKey={dayKey} placeholder={current} />
        <p className="mt-1.5 font-mono text-[9px] tracking-[0.06em] text-ink-3">
          лучше утром, натощак, в одинаковых условиях
        </p>
      </div>

      {/* ── Калории ── */}
      <CalorieInput todayISO={dayKey} history={calories} />
    </>
  );
}
