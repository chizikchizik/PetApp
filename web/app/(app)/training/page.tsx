import Link from "next/link";
import { getCurrentCycle, PHASE_LABELS, type Phase } from "@/lib/cycle";
import {
  getPeriodStarts,
  getWorkoutTemplates,
  getWorkoutHistory,
  getSportActivityDays,
  getMigraineEventsSince,
  getWorkoutCountForYear,
  getSportTypes,
} from "@/lib/data";
import { getRecentWorkouts } from "./actions";
import { TrainingForm } from "./training-form";
import { TrainingChart } from "./training-chart";
import { WorkoutHistoryList } from "./workout-history";
import { computeTrainingPatterns, type TrainingPattern } from "@/lib/training-patterns";
import { todayISOMoscow, isoDaysFromTodayMoscow, nowMoscow, isoLocal } from "@/lib/format";
import { getCalendarEvents } from "./schedule/actions";
import { PlannedToday } from "./planned-today";
import { getCurrentUser, isPregnant } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── Adaptive patterns block ──────────────────────────────────────────────────

const PROTOCOL = (
  <div className="border-t border-line pt-3">
    <div className="mb-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">
      протокол (уровень B, AAN)
    </div>
    <ul className="space-y-0.5 font-sans text-[12px] leading-[1.5] text-ink-2">
      <li>· 500 мл воды за 2 ч до + 200 мл каждые 20 мин</li>
      <li>· Разминка не менее 10 мин — резкий старт независимый триггер</li>
      <li>· HIIT и спринты — доказанный провокатор, осторожно</li>
    </ul>
  </div>
);

function PatternsBlock({ pattern }: { pattern: TrainingPattern }) {
  // Empty / insufficient states — show inline hint, no red-bordered block
  if (pattern.state === "no_workouts") {
    return (
      <div className="mt-4 rounded-card border border-dashed border-line bg-surface p-4">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">паттерны</div>
        <p className="mt-2 font-sans text-[12.5px] leading-[1.55] text-ink-2">
          Начни записывать тренировки — через несколько недель здесь появится анализ связи нагрузки с мигренью.
        </p>
      </div>
    );
  }

  if (pattern.state === "too_few") {
    return (
      <div className="mt-4 rounded-card border border-dashed border-line bg-surface p-4">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">паттерны</div>
        <p className="mt-2 font-sans text-[12.5px] leading-[1.55] text-ink-2">
          Записано {pattern.count} тренировок — нужно не менее 10 за полгода для статистически значимого анализа. Продолжай логировать.
        </p>
      </div>
    );
  }

  if (pattern.state === "no_migraines") {
    return (
      <div className="mt-4 rounded-card border border-line bg-surface p-4" style={{ borderLeft: "3px solid var(--phase)" }}>
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-phase">паттерны</div>
        <div className="mt-3">
          <div className="font-sans font-semibold text-[13px] text-ink">Мигреней в периоде не зафиксировано</div>
          <p className="mt-0.5 font-sans text-[12px] leading-[1.5] text-ink-2">
            За анализируемый период ({pattern.count} тренировок) мигреней не было — нет данных для поиска постнагрузочных паттернов.
            Самый активный день недели — <b className="text-ink">{pattern.topDowLabel}</b> ({pattern.topDowCount} тренировок).
          </p>
          <div className="mt-1 font-mono text-[10px] text-ink-3">
            → если мигрени появятся — отмечай их на экране «Сегодня», и паттерны рассчитаются автоматически
          </div>
        </div>
      </div>
    );
  }

  if (pattern.state === "no_pattern") {
    return (
      <div className="mt-4 rounded-card border border-line bg-surface p-4" style={{ borderLeft: "3px solid #d04830" }}>
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "#d04830" }}>
          паттерны · анализ
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <div className="font-sans font-semibold text-[13px] text-ink">Связи нагрузки с мигренью не выявлено</div>
            <p className="mt-0.5 font-sans text-[12px] leading-[1.5] text-ink-2">
              За период: {pattern.count} тренировок, {pattern.migCount} мигреней.
              Постнагрузочный паттерн (мигрень через 24–48 ч после тренировки) встречается в {pattern.overallRate}% случаев —
              ниже порога значимости. Тренировки, вероятно, не основной триггер.
            </p>
            <div className="mt-1 font-mono text-[10px] text-ink-3">
              → ищи тригеры в другом: сон, питание, гормональный цикл, стресс
            </div>
          </div>
          {PROTOCOL}
        </div>
        <p className="mt-3 font-mono text-[9px] text-ink-4">
          n={pattern.migCount} мигрень · гипотеза, не статвывод
        </p>
      </div>
    );
  }

  // state === "postexertional"
  return (
    <div className="mt-4 rounded-card border border-line bg-surface p-4" style={{ borderLeft: "3px solid #d04830" }}>
      <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "#d04830" }}>
        паттерны · анализ
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <div className="font-sans font-semibold text-[13px] text-ink">
            {pattern.peakDowLabel} → {pattern.nextDowLabel}: постнагрузочная мигрень?
          </div>
          <p className="mt-0.5 font-sans text-[12px] leading-[1.5] text-ink-2">
            {pattern.peakPostEx} из {pattern.peakWorkouts} тренировок в {pattern.peakDowLabel.toLowerCase()} предшествовали мигрени на следующий день
            ({pattern.peakRate}%). Общий постнагрузочный показатель: {pattern.overallRate}% тренировок → мигрень 24–48 ч.
            Латентность 6–24 ч биологически правдоподобна: спазм церебральных сосудов после высокой нагрузки.
          </p>
          <div className="mt-1 font-mono text-[10px] text-ink-3">
            → снизить интенсивность {pattern.peakDowLabel.toLowerCase()} до RPE 6–7 и проследить
          </div>
        </div>
        {PROTOCOL}
      </div>
      <p className="mt-3 font-mono text-[9px] text-ink-4">
        n={pattern.migCount} мигрень · гипотеза, не статвывод · наложи на фазу цикла для подтверждения
      </p>
    </div>
  );
}

const PHASE_TIP: Record<Phase, { title: string; text: string }> = {
  menstrual: {
    title: "Бережный режим",
    text: "Лёгкое движение и мобильность. Помним про железо — оно сейчас расходуется.",
  },
  follicular: {
    title: "Окно силы",
    text: "Лучшее время для силовых и прогрессий. Бери новые веса — тело отвечает.",
  },
  ovulatory: {
    title: "Пик — связки слабее",
    text: "Сила максимальна, но коллаген мягче. Контролируй технику и амплитуду.",
  },
  luteal: {
    title: "Снижаем обороты",
    text: "Объём, техника, восстановление. Задержка воды — норма, не пугайся весов.",
  },
};

/** Фактический темп за прошедшую часть года: тренировок / прошедших недель,
 * округлено — не прогноз на оставшиеся дни, а то, что реально было. */
function paceText(yearCount: number, year: number): string {
  const startOfYear = new Date(year, 0, 1).getTime();
  const daysElapsed = Math.max(1, Math.ceil((Date.now() - startOfYear) / 86400000));
  const weeksElapsed = daysElapsed / 7;
  const perWeek = Math.round(yearCount / weeksElapsed);
  return `в среднем ${perWeek} ${pluralTimes(perWeek)} в неделю`;
}

/** Русское склонение: 1 раз, 2 раза, 5 раз. */
function pluralTimes(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  return a > 10 && a < 20 ? "раз" : b === 1 ? "раз" : b >= 2 && b <= 4 ? "раза" : "раз";
}

export default async function TrainingPage() {
  const sinceISO = isoDaysFromTodayMoscow(-26 * 7);
  const year = nowMoscow().getUTCFullYear();
  const todayISO = todayISOMoscow();
  const today = new Date(todayISO + "T12:00:00");
  const dow = (today.getDay() + 6) % 7; // Пн=0
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return isoLocal(d);
  });
  // История-хитмап показывает весь календарный год, а анализ паттернов —
  // скользящее полугодие (26 нед). Грузим с более ранней из двух дат и
  // режем на месте: в начале года 26 недель уходят в прошлый год.
  const yearStartISO = `${year}-01-01`;
  const fetchFrom = yearStartISO < sinceISO ? yearStartISO : sinceISO;
  const [starts, workouts, templates, sportTypes, workoutHistoryAll, sportDaysAll, migrainesAll, yearCount, user, weekEvents] = await Promise.all([
    getPeriodStarts(),
    getRecentWorkouts(),
    getWorkoutTemplates(),
    getSportTypes(),
    getWorkoutHistory(fetchFrom),
    getSportActivityDays(fetchFrom),
    getMigraineEventsSince(fetchFrom),
    getWorkoutCountForYear(year),
    getCurrentUser(),
    getCalendarEvents(weekDates[0], weekDates[6]),
  ]);
  const workoutHistory = workoutHistoryAll.filter((w) => w.date >= sinceISO);
  const migraines = migrainesAll.filter((m) => m.date >= sinceISO);
  const yearWorkouts = workoutHistoryAll.filter((w) => w.date >= yearStartISO);
  const yearSports = sportDaysAll.filter((s) => s.date >= yearStartISO);
  const yearMigraines = migrainesAll.filter((m) => m.date >= yearStartISO);
  const pregnant = isPregnant(user);
  const { phase } = getCurrentCycle(starts, today, user?.avgCycleLength ?? 28, user?.menstrualDays ?? 5);
  const tip = PHASE_TIP[phase];
  const pattern = computeTrainingPatterns(workoutHistory, migraines);

  // Неделя: точка — тренировка записана, кружок — запланирована и ещё не была.
  const doneDays = new Set(workoutHistoryAll.filter((w) => w.date >= weekDates[0] && w.date <= weekDates[6]).map((w) => w.date));
  const plannedDays = new Set(weekEvents.filter((e) => e.type === "workout" && e.status === "planned").map((e) => e.event_date));
  const weekCount = workoutHistoryAll.filter((w) => w.date >= weekDates[0] && w.date <= todayISO).length;
  const plannedToday = weekEvents.filter((e) => e.event_date === todayISO && e.type === "workout" && e.status === "planned");
  const GOAL = user?.workoutYearGoal ?? 150;
  const goalPct = Math.min(100, Math.round((yearCount / GOAL) * 100));
  const left = GOAL - yearCount;

  return (
    <>
      {/* ── Шапка ── */}
      <h1 className="font-serif font-bold text-[24px] uppercase leading-tight">ТРЕНИРОВКИ</h1>
      {pregnant ? (
        <p className="mt-2 border-l-2 border-phase pl-2.5 font-sans text-[13px] leading-snug text-ink-2">
          Фазовые рекомендации скрыты на время беременности. Программу нагрузок согласуй с врачом.
        </p>
      ) : (
        <p className="mt-2 border-l-2 border-phase pl-2.5 font-sans text-[13px] leading-snug text-ink-2">
          <b className="text-ink">{PHASE_LABELS[phase]} · {tip.title}.</b> {tip.text}
        </p>
      )}

      {/* ── Неделя из расписания ── */}
      <section className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3">
            эта неделя · {weekCount} {weekCount % 10 === 1 && weekCount % 100 !== 11 ? "тренировка" : [2, 3, 4].includes(weekCount % 10) && ![12, 13, 14].includes(weekCount % 100) ? "тренировки" : "тренировок"}
          </span>
          <Link href="/training/schedule" className="flex min-h-[36px] items-center font-mono text-[11px] text-ink-2 underline underline-offset-2">
            расписание →
          </Link>
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1 text-center">
          {weekDates.map((iso, i) => {
            const isToday = iso === todayISO;
            const done = doneDays.has(iso);
            const planned = !done && plannedDays.has(iso);
            return (
              <div key={iso}>
                <div className="font-mono text-[11px] text-ink-3">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][i]}</div>
                <div className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full font-mono text-[12px] ${isToday ? "bg-phase font-semibold text-on-phase" : "text-ink-2"}`}>
                  {parseInt(iso.slice(8), 10)}
                </div>
                <div className="mt-1 flex h-3 items-center justify-center" aria-label={done ? "тренировка была" : planned ? "запланирована" : undefined}>
                  {done && <span className="h-1.5 w-1.5 rounded-full bg-phase" />}
                  {planned && <span className="h-2 w-2 rounded-full border-[1.5px] border-phase" />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-4 font-mono text-[11px] text-ink-2">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-phase" /> была</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-[1.5px] border-phase" /> по плану</span>
        </div>
      </section>

      <PlannedToday events={plannedToday} dayKey={todayISO} />

      {/* ── Записать тренировку ── */}
      <TrainingForm templates={templates} sportTypes={sportTypes} />

      {/* ── Счётчик года ── */}
      <div className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            тренировок в {year}
          </span>
          <span className="font-mono text-[11px] text-ink-3">
            цель {GOAL}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-serif font-bold text-[36px] leading-none text-ink">{yearCount}</span>
          <span className="font-mono text-[13px] text-ink-3">/ {GOAL}</span>
          <span className="ml-auto font-mono text-[11px] text-ink-2">{goalPct}%</span>
        </div>
        <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-phase transition-all"
            style={{ width: `${goalPct}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] text-ink-3">
          {left > 0
            ? `ещё ${left} · ${paceText(yearCount, year)}`
            : "цель достигнута 🎯"}
        </p>
      </div>

      {/* ── Инфографика (цветная по видам спорта — без изменений) ── */}
      <TrainingChart
        workouts={yearWorkouts}
        sports={yearSports}
        migraines={yearMigraines}
        sportTypes={sportTypes}
        range="year"
      />

      {/* ── Паттерны (адаптивные) ── */}
      <PatternsBlock pattern={pattern} />

      {/* ── История ── */}
      <WorkoutHistoryList workouts={workouts} />
    </>
  );
}
