import Link from "next/link";
import { getPeriodStarts, getWeightEntries, getCurrentWeight, getCalorieEntries, WEIGHT_GOAL } from "@/lib/data";
import { getCurrentCycle, PHASE_LABELS, type Phase } from "@/lib/cycle";
import { getCurrentUser, isPregnant } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";
import { WeightChart } from "@/components/weight-chart";
import { WeightInput } from "./weight-input";
import { WeightHistory } from "./weight-history";
import { CalorieInput } from "./calorie-input";
import { PlanEditor } from "./plan-editor";

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
  const [starts, rows, current, calories, user] = await Promise.all([
    getPeriodStarts(),
    getWeightEntries(),
    getCurrentWeight(),
    getCalorieEntries(),
    getCurrentUser(),
  ]);
  // При беременности вес остаётся наблюдением (ценно для врача), но вся
  // оценочность скрывается: цель похудения, план, дефицит/профицит,
  // фазовые подсказки (ревью Елены).
  const pregnant = isPregnant(user);
  const c = getCurrentCycle(starts, today, user?.avgCycleLength ?? 28, user?.menstrualDays ?? 5);
  const goalKg = user?.weightGoalKg ?? WEIGHT_GOAL.kg;
  const startKg = user?.weightStartKg ?? WEIGHT_GOAL.startKg;
  const fromStart = current != null ? +(current - startKg).toFixed(1) : null;
  const toGoal = current != null ? +(current - goalKg).toFixed(1) : null;

  // Среднее ккал за 7 дней, заканчивая ВЧЕРА — но только если за вчера
  // реально введены калории (сегодняшний день обычно неполный, поэтому окно
  // до вчера; нет записи за вчера → показатель не выводим, чтобы не показать
  // устаревшее/неполное среднее).
  const yesterday = (() => { const d = new Date(dayKey + "T12:00:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const weekStart = (() => { const d = new Date(yesterday + "T12:00:00"); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();
  const hasYesterday = calories.some((e) => e.date === yesterday);
  const weekWindow = calories.filter((e) => e.date >= weekStart && e.date <= yesterday);
  const avg7 = hasYesterday && weekWindow.length > 0
    ? Math.round(weekWindow.reduce((s, e) => s + e.kcal, 0) / weekWindow.length)
    : null;

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
        {pregnant ? "наблюдение · цели скрыты на время беременности" : `план и факт · цель ${goalKg} кг`}
      </p>

      {/* ── Текущий вес ── */}
      <section className="mt-4 flex items-end justify-between rounded-card border border-line bg-surface p-5">
        <div>
          <div className="font-mono text-[46px] font-semibold leading-[0.9] text-ink">
            {current ?? "—"}
          </div>
          <div className="mt-1.5 font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3">
            кг сегодня
          </div>
        </div>
        <div className="text-right">
          {pregnant ? null : fromStart != null && toGoal != null ? (
            <>
              <div className="font-mono font-semibold text-[15px] text-phase">
                {fromStart} кг
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-2">от старта {startKg}</div>
              <div className="mt-0.5 font-mono text-[10px] text-ink-2">
                до цели {toGoal > 0 ? `−${toGoal}` : toGoal} кг
              </div>
            </>
          ) : (
            <div className="font-mono text-[11px] text-ink-3">запиши первый вес ↓</div>
          )}
        </div>
      </section>

      {/* ── График ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-phase" /> вес (факт)
          </span>
          {!pregnant && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-ink-3" /> план
            </span>
          )}
          {calories.length > 0 && !pregnant && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-4 rounded-[1px]" style={{ background: "var(--deficit)" }} /> дефицит
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-4 rounded-[1px]" style={{ background: "var(--warn)" }} /> профицит
              </span>
            </>
          )}
          {calories.length > 0 && pregnant && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-4 rounded-[1px] bg-phase opacity-30" /> ккал
            </span>
          )}
          {calories.length >= 2 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: "var(--ink-2)" }} /> среднее 7 дней
            </span>
          )}
        </div>
        <div className="mt-3">
          <WeightChart
            rows={rows}
            goalKg={goalKg}
            goalDateISO={WEIGHT_GOAL.dateISO}
            todayISO={dayKey}
            calories={calories}
            calorieBalanceKcal={pregnant ? null : user?.calorieBalanceKcal}
            calorieGoalKcal={pregnant ? null : user?.calorieGoalKcal}
            showTargets={!pregnant}
          />
        </div>
        {avg7 != null && (
          <div className="mt-3 flex items-baseline gap-2 border-t border-line pt-2.5">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3">ср. 7 дней (по вчера)</span>
            <span className="font-mono text-[16px] font-semibold text-ink">{avg7.toLocaleString("ru")}</span>
            <span className="font-mono text-[10px] text-ink-3">ккал/день</span>
          </div>
        )}
        {calories.length > 0 && !user?.calorieBalanceKcal && !pregnant && (
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-ink-3">
            Укажи точку баланса калорий в профиле, чтобы столбики окрашивались по дефициту/профициту.
          </p>
        )}
      </section>

      {/* ── План похудения ── */}
      {!pregnant && <PlanEditor rows={rows} todayISO={dayKey} />}

      {/* ── Инсайт фазы ── */}
      {!pregnant && (
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
      )}

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

      <WeightHistory todayISO={dayKey} rows={rows} />

      {/* ── Калории ── */}
      <CalorieInput todayISO={dayKey} history={calories} />
    </>
  );
}
