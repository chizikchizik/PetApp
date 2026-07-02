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
import { todayISOMoscow, isoDaysFromTodayMoscow, nowMoscow, pluralDays } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";

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
            → если мигрени появятся — отмечай их через Чек-ин, и паттерны рассчитаются автоматически
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
        паттерны · елена
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

/** "в среднем 2 в день" при темпе ≥1/день, иначе "в среднем раз в N дней" —
 * "1 в день" при реальном темпе 0.3/день (было раньше, Math.ceil всегда
 * округлял вверх минимум до 1) вводило в заблуждение. */
function paceText(left: number, year: number): string {
  const daysLeft = Math.max(1, Math.ceil((new Date(year, 11, 31).getTime() - Date.now()) / 86400000));
  const perDay = left / daysLeft;
  if (perDay >= 1) return `в среднем ${Math.ceil(perDay)} в день`;
  const everyN = Math.max(1, Math.round(daysLeft / left));
  return everyN <= 1 ? "в среднем раз в день" : `в среднем раз в ${pluralDays(everyN)}`;
}

export default async function TrainingPage() {
  const sinceISO = isoDaysFromTodayMoscow(-26 * 7);
  const year = nowMoscow().getUTCFullYear();
  const today = new Date(todayISOMoscow() + "T12:00:00");
  const [starts, workouts, templates, sportTypes, workoutHistory, sportDays, migraines, yearCount, user] = await Promise.all([
    getPeriodStarts(),
    getRecentWorkouts(),
    getWorkoutTemplates(),
    getSportTypes(),
    getWorkoutHistory(sinceISO),
    getSportActivityDays(sinceISO),
    getMigraineEventsSince(sinceISO),
    getWorkoutCountForYear(year),
    getCurrentUser(),
  ]);
  const { phase } = getCurrentCycle(starts, today, user?.avgCycleLength ?? 28, user?.menstrualDays ?? 5);
  const tip = PHASE_TIP[phase];
  const pattern = computeTrainingPatterns(workoutHistory, migraines);

  return (
    <>
      {/* ── Шапка ── */}
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        ТРЕНИНГ
      </h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">
        лог активности · {PHASE_LABELS[phase]}
      </p>

      {/* ── Счётчик года ── */}
      {(() => {
        const GOAL = user?.workoutYearGoal ?? 150;
        const pct = Math.min(100, Math.round((yearCount / GOAL) * 100));
        const left = GOAL - yearCount;
        return (
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
              <span className="ml-auto font-mono text-[11px] text-ink-2">{pct}%</span>
            </div>
            <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-phase transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] text-ink-3">
              {left > 0
                ? `ещё ${left} · ${paceText(left, year)}`
                : "цель достигнута 🎯"}
            </p>
          </div>
        );
      })()}

      {/* ── Инфографика ── */}
      <TrainingChart
        workouts={workoutHistory}
        sports={sportDays}
        migraines={migraines}
        sportTypes={sportTypes}
      />

      {/* ── Паттерны (адаптивные) ── */}
      <PatternsBlock pattern={pattern} />

      {/* ── Директива фазы ── */}
      <div
        className="mt-5 rounded-card border border-line bg-surface p-4"
        style={{ borderLeft: "3px solid var(--phase)" }}
      >
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-phase">
          директива фазы
        </div>
        <div className="mt-2 font-sans font-bold text-[16px] leading-[1.2] text-ink">
          {tip.title}
        </div>
        <p className="mt-1.5 font-sans text-[12.5px] leading-[1.5] text-ink-2">
          {tip.text}
        </p>
      </div>

      {/* ── Ссылка на расписание ── */}
      <Link
        href="/training/schedule"
        className="mt-3.5 block font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3 text-right underline underline-offset-2"
      >
        расписание недели →
      </Link>

      {/* ── Добавить тренировку ── */}
      <TrainingForm templates={templates} sportTypes={sportTypes} />

      {/* ── История ── */}
      <WorkoutHistoryList workouts={workouts} />
    </>
  );
}
