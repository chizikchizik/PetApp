import { getPeriodStarts, getWeightEntries, getCurrentWeight, getCalorieEntries, WEIGHT_GOAL } from "@/lib/data";
import { getCurrentCycle, PHASE_LABELS, type Phase } from "@/lib/cycle";
import { getCurrentUser, isPregnant } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";
import { WeightChart } from "@/components/weight-chart";
import { DayNumbersCard } from "@/components/day-numbers-card";
import { WeightHistory } from "./weight-history";
import { CalorieInput } from "./calorie-input";
import { PlanEditor } from "./plan-editor";

export const dynamic = "force-dynamic";

const PHASE_NOTE: Record<Phase, string> = {
  menstrual: "Вес может быть выше из-за задержки воды — это уйдёт.",
  follicular: "Вес сейчас наиболее показателен: минимум задержки воды.",
  ovulatory: "Возможна лёгкая задержка воды.",
  luteal: "Задержка воды может прибавить 0,5–1,5 кг. Это не жир — не пугайся весов.",
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
  const actualRows = rows.filter((r): r is typeof r & { actual: number } => r.actual != null);
  const todayWeight = actualRows.find((r) => r.date === dayKey)?.actual ?? null;
  // Изменение за неделю — от последнего взвешивания не позже чем 7 дней назад.
  const weekAgoISO = (() => { const d = new Date(dayKey + "T12:00:00"); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();
  const weekAgo = [...actualRows].reverse().find((r) => r.date <= weekAgoISO) ?? null;
  const weekDelta = current != null && weekAgo ? +(current - weekAgo.actual).toFixed(1) : null;
  const fmtKg = (n: number) => String(n).replace(".", ",");
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtKg(Math.abs(n))}`;
  // Прогресс от старта к цели (только когда цель ниже старта — похудение).
  const progressPct = current != null && startKg > goalKg
    ? Math.max(0, Math.min(100, Math.round(((startKg - current) / (startKg - goalKg)) * 100)))
    : null;

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
  const yesterdayKcal = calories.find((e) => e.date === yesterday)?.kcal ?? null;
  const balance = avg7 != null && user?.calorieBalanceKcal ? avg7 - user.calorieBalanceKcal : null;

  return (
    <>
      {/* ── Шапка: текущий вес ── */}
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">вес</div>
      <h1 className="mt-1 font-mono text-[40px] font-semibold leading-none text-ink">
        {current != null ? fmtKg(current) : "—"}<span className="ml-1.5 text-[16px] font-normal text-ink-2">кг</span>
      </h1>
      <p className="mt-2 font-sans text-[13px] text-ink-2">
        {current == null
          ? "Запиши первый вес — ниже."
          : [
              weekDelta != null ? `${signed(weekDelta)} за неделю` : null,
              !pregnant ? `цель ${fmtKg(goalKg)} кг` : "цели скрыты на время беременности",
            ].filter(Boolean).join(" · ")}
      </p>
      {!pregnant && progressPct != null && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-phase" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-2">
            <span>старт {fmtKg(startKg)}</span>
            <span>пройдено {progressPct}%</span>
            <span>цель {fmtKg(goalKg)}</span>
          </div>
        </div>
      )}

      {/* ── Ввод: та же карточка, что на «Сегодня» ── */}
      <div className="mt-5 rounded-card border border-line bg-surface p-4">
        <DayNumbersCard
          weightDay={dayKey}
          kcalDay={yesterday}
          initialWeight={todayWeight}
          initialKcal={yesterdayKcal}
          weightPlaceholder={todayWeight == null ? current : null}
          kcalLabel="Ккал вчера"
        />
        <p className="mt-2 font-sans text-[12px] text-ink-2">Вес лучше утром, натощак, в одинаковых условиях.</p>
      </div>

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
          <div className="mt-3 grid grid-cols-2 divide-x divide-line border-t border-line pt-2.5">
            <div className="pr-3">
              <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-3">ккал · 7 дней по вчера</div>
              <div className="mt-1 font-mono text-[18px] font-semibold text-ink">{avg7.toLocaleString("ru")}</div>
            </div>
            {balance != null && !pregnant && (
              <div className="pl-3">
                <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-3">к точке баланса</div>
                <div className={`mt-1 font-mono text-[18px] font-semibold ${balance < 0 ? "text-deficit" : "text-ink"}`}>
                  {balance > 0 ? "+" : balance < 0 ? "−" : ""}{Math.abs(balance).toLocaleString("ru")}
                </div>
              </div>
            )}
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

      {/* ── Подсказка фазы ── */}
      {!pregnant && (
        <p className="mt-3.5 border-l-2 border-phase pl-2.5 font-sans text-[13px] leading-snug text-ink-2">
          <b className="text-ink">{PHASE_LABELS[c.phase]}, день {c.day}.</b> {PHASE_NOTE[c.phase]}
        </p>
      )}

      <WeightHistory todayISO={dayKey} rows={rows} />

      {/* ── Калории ── */}
      <CalorieInput todayISO={dayKey} history={calories} />
    </>
  );
}
