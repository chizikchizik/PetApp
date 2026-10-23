import Link from "next/link";
import { getCurrentCycle, PHASE_LABELS, type Phase } from "@/lib/cycle";
import { MIGRAINE } from "@/lib/seed-data";
import {
  getPeriodStarts,
  getDailyLog,
  getMeds,
  getMedMonthlyCounts,
  getMigraineTriggers,
  getSportTypes,
  getQuickPainEntries,
  getMigraineMedStats,
  getRecentActualWeights,
  getWorkoutHistory,
  getMigraineEventsSince,
} from "@/lib/data";
import { getCurrentUser, isPregnant, ALL_TRACKED } from "@/lib/auth";
import { formatDay, pluralDays, todayISOMoscow, isoLocal } from "@/lib/format";
import { getCalendarEvents } from "../training/schedule/actions";
import { TodayDay } from "./today-day";
import { DayNav, PeriodStartButton } from "./day-controls";

export const dynamic = "force-dynamic";

// «Сегодня» — бывшие дашборд и чек-ин на одном экране. Наверху кнопка
// приступа и три цифры, ниже то, что отмечается за день; каждое касание
// сохраняется сразу. ?date=YYYY-MM-DD открывает прошлый день для дозаполнения.

const WEEK_TYPE_COLORS: Record<string, string> = {
  workout: "var(--phase)",
  event: "var(--ink-2)",
  reminder: "var(--warn, #e8a23a)",
};
const DOW_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const MONTH_SHORT = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];
const MONTH_IN = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
const WEEKDAY_SHORT = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];

const PHASE_TIP: Record<Phase, { title: string; text: string }> = {
  menstrual: { title: "Бережный режим", text: "Лёгкое движение и мобильность. Помним про железо." },
  follicular: { title: "Окно силы", text: "Лучшее время для силовых и прогрессий. Бери новые веса." },
  ovulatory: { title: "Пик — связки слабее", text: "Сила максимальна, но коллаген мягче. Контролируй технику." },
  luteal: { title: "Снижаем обороты", text: "Объём, техника, восстановление. Задержка воды — норма." },
};

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);
}

function fmtSigned(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toString().replace(".", ",")}`;
}

export default async function Today({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const todayISO = todayISOMoscow();
  const dayKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayISO ? date : todayISO;
  const isToday = dayKey === todayISO;
  const target = new Date(dayKey + "T12:00:00");
  const today = new Date(todayISO + "T12:00:00");
  const todayYM = todayISO.slice(0, 7);
  const dayYM = dayKey.slice(0, 7);

  const dow = (today.getDay() + 6) % 7; // Пн=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return isoLocal(d);
  });
  const weekStart = weekDates[0];
  const dayInWeek = dayKey >= weekStart && dayKey <= weekDates[6];

  const [
    user, starts, log, meds, medCounts, triggers, sportTypes, quickPain,
    monthStats, dayMonthStats, weights, workoutsSince, weekEvents, dayEvents, attacks,
  ] = await Promise.all([
    getCurrentUser(),
    getPeriodStarts(),
    getDailyLog(dayKey),
    getMeds(),
    getMedMonthlyCounts(dayYM),
    getMigraineTriggers(),
    getSportTypes(),
    getQuickPainEntries(dayKey, dayKey),
    getMigraineMedStats(todayYM),
    dayYM === todayYM ? Promise.resolve(null) : getMigraineMedStats(dayYM),
    getRecentActualWeights(30),
    getWorkoutHistory(dayKey < weekStart ? dayKey : weekStart),
    getCalendarEvents(weekStart, weekDates[6]),
    dayInWeek ? Promise.resolve(null) : getCalendarEvents(dayKey, dayKey),
    getMigraineEventsSince(addDaysISO(dayKey, -365)),
  ]);

  const tracks = user?.tracks ?? ALL_TRACKED;
  const pregnant = isPregnant(user);
  // Для прошлого дня берём только старты не позже него, иначе getCurrentCycle
  // отсчитает «день цикла» от более позднего старта и уйдёт в минус.
  const startsUpToDay = isToday ? starts : starts.filter((d) => isoLocal(d) <= dayKey);
  const c = getCurrentCycle(startsUpToDay, target, user?.avgCycleLength ?? 28, user?.menstrualDays ?? 5);
  const displayName = user?.displayName || "VERTA";
  const isPeriodStart = starts.some((d) => isoLocal(d) === dayKey);

  // ── Мигрень: счётчик МИГБ (ICHD-3 8.2). Триптаны/эрготамины/опиоиды/комб.
  // анальгетики — одна цифра с порогом 10, НПВС — отдельно с порогом 15
  // (не два независимых лимита по 10, см. рецензию Елены).
  const highRiskPct = Math.round((monthStats.highRisk / MIGRAINE.triptanThreshold) * 100);
  const nsaidPct = Math.round((monthStats.nsaid / MIGRAINE.nsaidThreshold) * 100);
  const nsaidLeads = nsaidPct > highRiskPct;
  const leadCount = nsaidLeads ? monthStats.nsaid : monthStats.highRisk;
  const leadThreshold = nsaidLeads ? MIGRAINE.nsaidThreshold : MIGRAINE.triptanThreshold;
  const leadHigh = Math.max(highRiskPct, nsaidPct) >= 70;
  const ds = dayMonthStats ?? monthStats;
  const medNote =
    `В ${MONTH_IN[target.getMonth()]}: дней с триптанами и комб. анальгетиками — ${ds.highRisk} из ${MIGRAINE.triptanThreshold}, ` +
    `с НПВС — ${ds.nsaid} из ${MIGRAINE.nsaidThreshold}. Считаем дни приёма, а не дни боли.`;

  const lastAttack = attacks.filter((a) => a.date < dayKey).map((a) => a.date).sort().pop() ?? null;
  const lastAttackLabel = lastAttack
    ? (() => {
        const n = daysBetweenISO(lastAttack, dayKey);
        return `${formatDay(new Date(lastAttack + "T12:00:00"))} · ${n === 1 ? "вчера" : `${pluralDays(n)} назад`}`;
      })()
    : null;

  // ── Тренировки ──
  const weekWorkoutCount = workoutsSince.filter((w) => w.date >= weekStart && w.date <= todayISO).length;
  const dayWorkouts = workoutsSince.filter((w) => w.date === dayKey);
  const planned = (dayEvents ?? weekEvents).filter((ev) => ev.event_date === dayKey && ev.type === "workout");
  const eventsByDate = new Map<string, typeof weekEvents>();
  for (const ev of weekEvents) {
    const list = eventsByDate.get(ev.event_date) ?? [];
    list.push(ev);
    eventsByDate.set(ev.event_date, list);
  }

  // ── Вес: изменение за неделю, если есть запись недельной давности ──
  const current = weights.length ? weights[weights.length - 1] : null;
  const weekAgo = [...weights].reverse().find((w) => w.date <= addDaysISO(todayISO, -7)) ?? null;
  const weightSub = !current
    ? "нет записей"
    : weekAgo
      ? `${fmtSigned(current.actual - weekAgo.actual)} за нед`
      : user?.weightStartKg
        ? `${fmtSigned(current.actual - user.weightStartKg)} от старта`
        : "первая запись";

  const dateHeader = `${WEEKDAY_SHORT[target.getDay()]} ${target.getDate()} ${MONTH_SHORT[target.getMonth()]}`;
  const title = isToday ? "Сегодня" : dayKey === addDaysISO(todayISO, -1) ? "Вчера" : formatDay(target);

  const kpiTile = "flex-1 min-w-0 px-3 py-3 active:bg-surface-2";
  const kpis = (
    <div className="mt-4 flex divide-x divide-line overflow-hidden rounded-card border border-line bg-surface">
      {tracks.migraine && (
        <Link href="/insights" className={kpiTile}>
          <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-3">{nsaidLeads ? "НПВС" : "триптаны"}</div>
          <div className={`mt-1.5 font-mono text-[21px] font-semibold leading-none ${leadHigh ? "text-warn" : "text-ink"}`}>
            {leadCount}<span className="text-[12px] font-normal text-ink-2">/{leadThreshold}</span>
          </div>
          <div className={`mt-1 font-mono text-[11px] ${leadHigh ? "text-warn" : "text-ink-2"}`}>{leadHigh ? "близко к порогу" : "дней в месяце"}</div>
        </Link>
      )}
      {tracks.training && (
        <Link href="/training" className={kpiTile}>
          <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-3">тренировки</div>
          <div className="mt-1.5 font-mono text-[21px] font-semibold leading-none text-ink">{weekWorkoutCount}</div>
          <div className="mt-1 font-mono text-[11px] text-ink-2">за неделю</div>
        </Link>
      )}
      {tracks.weight && (
        <Link href="/weight" className={kpiTile}>
          <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-3">вес</div>
          <div className="mt-1.5 font-mono text-[21px] font-semibold leading-none text-ink">
            {current ? current.actual.toString().replace(".", ",") : "—"}
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-2">{weightSub}</div>
        </Link>
      )}
    </div>
  );
  const kpiBlock = (
    <>
      {kpis}
      {tracks.migraine && monthStats.unclassified > 0 && (
        <Link href="/checkin/meds" className="mt-1.5 flex min-h-[36px] items-center font-sans text-[12px] text-ink-2 underline underline-offset-2">
          {monthStats.unclassified === 1 ? "1 препарат без типа" : `${monthStats.unclassified} препарата без типа`} — не попадает в счётчик. Указать тип →
        </Link>
      )}
    </>
  );

  return (
    <div className={!isToday && !pregnant ? `phase-${c.phase}` : undefined}>
      {/* ── Шапка ── */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-phase">{dateHeader}</div>
          <h1 className="mt-1 font-serif text-[23px] font-bold uppercase leading-[1.05]">{title}</h1>
        </div>
        <Link
          href="/profile"
          aria-label="Профиль"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line font-serif text-[14px] font-bold text-ink-2 transition active:scale-[0.95]"
        >
          {displayName[0]?.toUpperCase() ?? "?"}
        </Link>
      </header>

      <DayNav dayKey={dayKey} todayISO={todayISO} />

      {/* ── Цикл: контекст одной строкой ── */}
      {!pregnant && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/cycle"
            className="inline-flex min-h-[36px] items-center gap-2 rounded-[3px] bg-phase-soft px-2.5 font-mono text-[12px] text-phase-deep"
          >
            <span className="h-[7px] w-[7px] rounded-full bg-phase" />
            день {c.day} · {PHASE_LABELS[c.phase].toLowerCase()}
          </Link>
          {isToday && tracks.migraine && c.inMigraineWindow && (
            <span className="rounded-[3px] border border-warn px-2 py-1 font-mono text-[11px] text-warn">окно риска мигрени</span>
          )}
          {isToday && !c.inMigraineWindow && c.daysUntilNextPeriod.likely > 0 && (
            <span className="font-mono text-[12px] text-ink-2">месячные ≈ через {pluralDays(c.daysUntilNextPeriod.likely)}</span>
          )}
          <span className="ml-auto">
            <PeriodStartButton key={dayKey} dayKey={dayKey} isStart={isPeriodStart} />
          </span>
        </div>
      )}

      {/* ── Беременность ── */}
      {pregnant && (
        <section className="mt-4 rounded-card border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-phase" />
            <span className="font-sans text-[14px] font-bold">Беременность</span>
          </div>
          <p className="mt-2 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            Фазы цикла на паузе — наблюдения (вес, мигрень, препараты, тренировки) продолжаются.
          </p>
          <div className="mt-3 rounded-[3px] border border-line bg-surface-2 p-3" style={{ borderLeft: "2px solid var(--warn)" }}>
            <p className="font-sans text-[12px] leading-[1.55] text-ink-2">
              Сильная или необычная головная боль, особенно с давлением 140/90 и выше,
              нарушениями зрения или отёками — срочно свяжись с врачом. Впервые
              возникшая аура — повод показаться неврологу.
            </p>
          </div>
          <Link
            href="/bp"
            className="mt-3 flex min-h-[44px] items-center justify-between rounded-[3px] border border-line bg-surface-2 px-3.5 font-mono text-[11px] tracking-[0.1em] uppercase text-ink-2 active:scale-[0.99]"
          >
            <span>дневник давления · утро и вечер</span>
            <span className="text-phase">→</span>
          </Link>
        </section>
      )}

      <TodayDay
        key={dayKey}
        dayKey={dayKey}
        dateLabel={isToday ? "сегодня" : formatDay(target)}
        initial={log}
        meds={meds}
        medCounts={medCounts}
        triggers={triggers}
        sportTypes={sportTypes}
        quickPain={quickPain}
        planned={planned}
        workouts={dayWorkouts}
        dayWeight={log?.weight_kg ?? weights.find((w) => w.date === dayKey)?.actual ?? null}
        weightPlaceholder={isToday ? current?.actual ?? null : null}
        lastAttackLabel={lastAttackLabel}
        medNote={medNote}
        phaseTip={pregnant ? null : PHASE_TIP[c.phase]}
        tracks={tracks}
        kpis={kpiBlock}
      />

      {/* ── Неделя из расписания ── */}
      {tracks.training && (
        <Link href="/training/schedule" className="mt-6 block rounded-card border border-line bg-surface p-4 active:scale-[0.99]">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3">расписание недели</div>
            <span className="font-mono text-[13px] text-phase">→</span>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {weekDates.map((iso, i) => {
              const dayEvs = eventsByDate.get(iso) ?? [];
              const isTodayCell = iso === todayISO;
              return (
                <div key={iso} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[11px] uppercase text-ink-3">{DOW_SHORT[i]}</span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px] ${
                      isTodayCell ? "bg-phase font-semibold text-on-phase" : "text-ink-2"
                    }`}
                  >
                    {parseInt(iso.slice(8), 10)}
                  </span>
                  <div className="flex h-[5px] gap-[2px]">
                    {dayEvs.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className="h-[5px] w-[5px] shrink-0 rounded-full"
                        style={{ background: WEEK_TYPE_COLORS[ev.type] ?? "var(--ink-3)" }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Link>
      )}
    </div>
  );
}
