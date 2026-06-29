import Link from "next/link";
import { getWeeklySchedule } from "@/lib/data";

export const dynamic = "force-dynamic";

const DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const TYPE_COLORS: Record<string, string> = {
  strength: 'var(--phase)',
  functional: 'var(--phase-deep)',
  volleyball: 'var(--ink-2)',
  run: 'var(--ink-2)',
  rest: 'var(--ink-4)',
};

const TYPE_LABELS: Record<string, string> = {
  strength: 'сила',
  functional: 'функционал',
  volleyball: 'волейбол',
  run: 'бег',
  rest: 'отдых',
};

export default async function SchedulePage() {
  const schedule = await getWeeklySchedule();

  // Build a map day_of_week -> schedule entry
  const byDay = new Map(schedule.map((d) => [d.day_of_week, d]));

  // Today detection
  const jsDay = new Date().getDay(); // 0=Sun
  const todayDow = jsDay === 0 ? 7 : jsDay; // convert to 1=Mon..7=Sun

  return (
    <>
      {/* ── Header ── */}
      <Link href="/training" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        ← тренинг
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase">РАСПИСАНИЕ</h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">тренировочная неделя</p>

      {/* ── Days grid ── */}
      <div className="mt-5 space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
          const d = byDay.get(dow);
          const isToday = dow === todayDow;
          const type = d?.workout_type ?? 'rest';

          return (
            <div
              key={dow}
              className={`rounded-card border p-4 bg-surface ${
                isToday ? "border-phase" : "border-line"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">
                  {DAYS[dow]}
                </div>
                {isToday && (
                  <span className="font-mono text-[9px] uppercase text-phase">сегодня</span>
                )}
              </div>

              {!d ? (
                <div className="mt-2 font-sans text-[13px] text-ink-4 italic">не настроено</div>
              ) : d.is_rest ? (
                <>
                  <span
                    style={{ color: TYPE_COLORS['rest'] }}
                    className="mt-1.5 block font-mono text-[9px] uppercase"
                  >
                    {TYPE_LABELS['rest']}
                  </span>
                  <div className="mt-1 font-sans text-[14px] text-ink-3">Выходной</div>
                </>
              ) : (
                <>
                  <span
                    style={{ color: TYPE_COLORS[type] ?? 'var(--ink-2)' }}
                    className="mt-1.5 block font-mono text-[9px] uppercase"
                  >
                    {TYPE_LABELS[type] ?? type}
                  </span>
                  <div className="mt-1 font-sans font-semibold text-[16px] text-ink">
                    {d.workout_label}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-ink-3">
                    {[d.time_start, d.duration_min ? `${d.duration_min} мин` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
