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

export const dynamic = "force-dynamic";

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


export default async function TrainingPage() {
  const since26w = new Date();
  since26w.setDate(since26w.getDate() - 26 * 7);
  const sinceISO = since26w.toISOString().slice(0, 10);

  const year = new Date().getFullYear();
  const [starts, workouts, templates, sportTypes, workoutHistory, sportDays, migraines, yearCount] = await Promise.all([
    getPeriodStarts(),
    getRecentWorkouts(),
    getWorkoutTemplates(),
    getSportTypes(),
    getWorkoutHistory(sinceISO),
    getSportActivityDays(sinceISO),
    getMigraineEventsSince(sinceISO),
    getWorkoutCountForYear(year),
  ]);
  const { phase } = getCurrentCycle(starts);
  const tip = PHASE_TIP[phase];

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
        const GOAL = 150;
        const pct = Math.min(100, Math.round((yearCount / GOAL) * 100));
        const left = GOAL - yearCount;
        return (
          <div className="mt-4 rounded-card border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
                тренировок в {year}
              </span>
              <span className="font-mono text-[11px] text-ink-3">
                цель 150
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-serif font-bold text-[36px] leading-none text-ink">{yearCount}</span>
              <span className="font-mono text-[13px] text-ink-3">/ 150</span>
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
                ? `ещё ${left} · в среднем ${Math.ceil(left / Math.max(1, Math.ceil((new Date(year, 11, 31).getTime() - Date.now()) / 86400000)))} в день`
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
      />

      {/* ── Анализ паттернов (Елена) ── */}
      <div className="mt-4 rounded-card border border-line bg-surface p-4" style={{ borderLeft: "3px solid #d04830" }}>
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "#d04830" }}>
          паттерны · елена
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <div className="font-sans font-semibold text-[13px] text-ink">ВТ → СР: постнагрузочная мигрень?</div>
            <p className="mt-0.5 font-sans text-[12px] leading-[1.5] text-ink-2">
              3 из 5 июньских мигреней пришлись на среду — самый нагруженный день накануне (вторник, 19 тренировок). Латентность 6–24 ч биологически правдоподобна: спазм церебральных сосудов после высокой нагрузки.
            </p>
            <div className="mt-1 font-mono text-[10px] text-ink-3">→ снизить интенсивность вт до RPE 6–7 и проследить</div>
          </div>

          <div className="border-t border-line pt-3">
            <div className="font-sans font-semibold text-[13px] text-ink">ПТ / ВС: скорее гормональный триггер</div>
            <p className="mt-0.5 font-sans text-[12px] leading-[1.5] text-ink-2">
              Соотношение мигреней к тренировкам в пт и вс максимальное, хотя нагрузка минимальна. Паттерн совпадает с поздней лютеиновой фазой — резкое падение эстрогена по ICHD-3.
            </p>
            <div className="mt-1 font-mono text-[10px] text-ink-3">→ в перименструальное окно — только ходьба, йога, плавание</div>
          </div>

          <div className="border-t border-line pt-3">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3 mb-1.5">протокол (уровень B, AAN)</div>
            <ul className="space-y-0.5 font-sans text-[12px] leading-[1.5] text-ink-2">
              <li>· 500 мл воды за 2 ч до + 200 мл каждые 20 мин</li>
              <li>· Разминка не менее 10 мин — резкий старт независимый триггер</li>
              <li>· HIIT и спринты — доказанный провокатор, осторожно</li>
            </ul>
          </div>
        </div>

        <p className="mt-3 font-mono text-[9px] text-ink-4">
          n=31 мигрень · гипотеза, не статвывод · наложи на фазу цикла для подтверждения
        </p>
      </div>

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
