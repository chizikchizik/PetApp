import Link from "next/link";
import { getCurrentCycle, PHASE_LABELS, type Phase } from "@/lib/cycle";
import { getPeriodStarts, getWorkoutTemplates } from "@/lib/data";
import { getRecentWorkouts } from "./actions";
import { TrainingForm } from "./training-form";
import { DeleteWorkoutButton } from "./delete-workout-button";

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

function fatigueLabel(pct: number): string {
  if (pct <= 30) return "лёгкая";
  if (pct <= 60) return "рабочая";
  if (pct <= 80) return "высокая";
  return "предел";
}

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default async function TrainingPage() {
  const [starts, workouts, templates] = await Promise.all([
    getPeriodStarts(),
    getRecentWorkouts(),
    getWorkoutTemplates(),
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

      {/* ── Директива фазы ── */}
      <div
        className="mt-4 rounded-card border border-line bg-surface p-4"
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
      <TrainingForm templates={templates} />

      {/* ── История ── */}
      {workouts.length > 0 && (
        <>
          <p className="mt-5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            история · нагрузка
          </p>
          <div className="mt-2 space-y-2">
            {workouts.map((w) => (
              <div
                key={w.id}
                className="rounded-card border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-sans font-semibold text-[14.5px] text-ink">
                    {w.type}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 font-mono text-[10px] text-ink-3">
                      {formatDate(w.workout_date)}
                    </div>
                    <DeleteWorkoutButton id={w.id} />
                  </div>
                </div>
                {w.fatigue_pct != null && (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className="h-[5px] flex-1 overflow-hidden rounded-[1px] bg-surface-3">
                      <div
                        className="h-full bg-phase"
                        style={{ width: `${w.fatigue_pct}%` }}
                      />
                    </div>
                    <div className="shrink-0 font-mono text-[10px] text-ink-2">
                      {w.fatigue_pct}% · {fatigueLabel(w.fatigue_pct)}
                    </div>
                  </div>
                )}
                <div className="mt-2 font-mono text-[10px] text-ink-3">
                  {[w.duration_min ? `${w.duration_min} мин` : null, w.note || null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
