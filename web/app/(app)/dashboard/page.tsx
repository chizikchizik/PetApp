import Link from "next/link";
import { getCurrentCycle, PHASE_LABELS, type Phase } from "@/lib/cycle";
import { MIGRAINE } from "@/lib/seed-data";
import {
  getPeriodStarts,
  getRecentActualWeights,
  getCurrentWeight,
  getTriptanCount,
  getHabits,
  getDailyLog,
  getMonthHabitStats,
  getRecentWearableData,
  WEIGHT_GOAL,
  type WearableDay,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { formatDay, pluralDays, todayISOMoscow, isoLocal } from "@/lib/format";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCalendarEvents } from "../training/schedule/actions";

const WEEK_TYPE_COLORS: Record<string, string> = {
  workout:  "var(--phase)",
  event:    "var(--ink-2)",
  reminder: "var(--warn, #e8a23a)",
};
const DOW_SHORT = ["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"];

const PHASE_TIP: Record<Phase, { title: string; text: string }> = {
  menstrual: {
    title: "Бережный режим",
    text: "Лёгкое движение и мобильность. Помним про железо.",
  },
  follicular: {
    title: "Окно силы",
    text: "Лучшее время для силовых и прогрессий. Бери новые веса.",
  },
  ovulatory: {
    title: "Пик — связки слабее",
    text: "Сила максимальна, но коллаген мягче. Контролируй технику.",
  },
  luteal: {
    title: "Снижаем обороты",
    text: "Объём, техника, восстановление. Задержка воды — норма.",
  },
};

const MONTH_SHORT = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"];
const WEEKDAY_SHORT = ["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"];

function formatDateHeader(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

function buildTicks(day: number, length: number) {
  const ticks = [];
  for (let i = 0; i < length; i++) {
    const a = (i / length) * 2 * Math.PI - Math.PI / 2;
    const inr = 72, outr = 86;
    ticks.push({
      x1: (100 + Math.cos(a) * inr).toFixed(1),
      y1: (100 + Math.sin(a) * inr).toFixed(1),
      x2: (100 + Math.cos(a) * outr).toFixed(1),
      y2: (100 + Math.sin(a) * outr).toFixed(1),
      active: i < day,
    });
  }
  return ticks;
}

export default async function Dashboard() {
  const todayISO = todayISOMoscow();
  const today = new Date(todayISO + "T12:00:00");
  const starts = await getPeriodStarts();
  const ym = todayISO.slice(0, 7);
  const todayStr = todayISO;

  const dow = (today.getDay() + 6) % 7; // Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return isoLocal(d);
  });

  const [user, triptan, weights, currentWeight, habits, todayLog, habitStats, wearable, weekEvents] = await Promise.all([
    getCurrentUser(),
    getTriptanCount(ym),
    getRecentActualWeights(8),
    getCurrentWeight(),
    getHabits(ym),
    getDailyLog(todayStr),
    getMonthHabitStats(ym),
    getRecentWearableData(7),
    getCalendarEvents(weekDates[0], weekDates[6]),
  ]);
  const eventsByDate = new Map<string, typeof weekEvents>();
  for (const ev of weekEvents) {
    const list = eventsByDate.get(ev.event_date) ?? [];
    list.push(ev);
    eventsByDate.set(ev.event_date, list);
  }
  const c = getCurrentCycle(starts, today, user?.avgCycleLength ?? 28, user?.menstrualDays ?? 5);
  const length = Math.round(c.stats.avgLength) || (user?.avgCycleLength ?? 28);
  const tip = PHASE_TIP[c.phase];
  const latestWearable = (wearable.length ? wearable[wearable.length - 1] : null) as WearableDay | null;

  const displayName = user?.displayName || "VERTA";
  const weightGoalKg = user?.weightGoalKg ?? WEIGHT_GOAL.kg;
  const weightStartKg = user?.weightStartKg ?? WEIGHT_GOAL.startKg;

  const triptanHigh = triptan >= 8;
  const weightDelta = currentWeight != null ? +(currentWeight - weightStartKg).toFixed(1) : null;
  const ws = weights.map((w) => w.actual);
  const wMin = ws.length ? Math.min(...ws) : 0;
  const wMax = ws.length ? Math.max(...ws) : 0;
  const spark = weights.length
    ? weights
        .map((w, i) => {
          const x = (i / (weights.length - 1 || 1)) * 100;
          const y = 26 - ((w.actual - wMin) / (wMax - wMin || 1)) * 22 - 2;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : "";

  const habitsSet = new Set(habits);
  const habitsDoneToday = (todayLog?.habits_done ?? []).filter((h) => habitsSet.has(h)).length;
  const totalHabits = habits.length;
  const monthPct = habitStats.daysLogged > 0 && totalHabits > 0
    ? Math.round((habitStats.done / (totalHabits * habitStats.daysLogged)) * 100)
    : 0;
  const tiptanPct = Math.min(100, Math.round((triptan / MIGRAINE.triptanThreshold) * 100));
  const ticks = buildTicks(c.day, length);

  return (
    <>
      {/* ── Шапка ── */}
      <header className="flex items-start justify-between pb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-phase">
            // {PHASE_LABELS[c.phase]}
          </div>
          <div className="mt-1.5 font-serif font-bold text-[23px] leading-[1.05] uppercase">
            {displayName.toUpperCase()}
          </div>
          <div className="mt-1.5 font-mono text-[11px] text-ink-3">
            ДЕНЬ {c.day} · {formatDateHeader(today)}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <ThemeToggle />
          <Link
            href="/profile"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border border-line font-serif font-bold text-[13px] text-ink-2 transition active:scale-[0.95]"
          >
            {displayName[0]?.toUpperCase() ?? "?"}
          </Link>
        </div>
      </header>

      {/* ── Главный циферблат ── */}
      <Link href="/cycle" className="block">
      <section className="relative overflow-hidden rounded-card border border-line bg-surface px-[18px] pb-5 pt-[22px] active:scale-[0.99] transition">
        <div className="absolute left-4 top-3 font-mono text-[9px] tracking-[0.16em] uppercase text-ink-3">
          цикл · {length} дн
        </div>
        <div className="absolute right-4 top-3 font-mono text-[9px] tracking-[0.12em] uppercase text-phase">
          ● live
        </div>

        <div className="relative mx-auto mt-1.5" style={{ width: 212, height: 212 }}>
          <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%" }}>
            <circle cx="100" cy="100" r="82" fill="none" stroke="var(--line)" strokeWidth="1" />
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.active ? "var(--phase)" : "var(--line-2)"}
                strokeWidth={t.active ? 3 : 2}
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-mono font-semibold leading-[0.9] tracking-[-0.02em] text-ink"
              style={{ fontSize: 64 }}
            >
              {c.day}
            </div>
            <div className="mt-1.5 font-mono text-[9px] tracking-[0.2em] uppercase text-ink-3">
              день цикла
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-center gap-2">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-phase" />
          <span className="font-sans font-bold text-[14px] tracking-[0.01em]">{tip.title}</span>
        </div>
        <p className="mt-2 text-center font-mono text-[11px] text-ink-2">
          ≈ {pluralDays(c.daysUntilNextPeriod.likely)} до месячных ·{" "}
          {formatDay(c.nextPeriod.earliest)} – {formatDay(c.nextPeriod.latest)}
        </p>
      </section>
      </Link>

      {/* ── Полоса готовности ── */}
      <div className="mt-3.5 flex overflow-hidden rounded-card border border-line bg-surface">
        <Link href="/weight" className="flex-1 border-r border-line px-3 py-3.5 active:bg-surface-2">
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3">вес</div>
          <div className="mt-1.5 font-mono font-semibold text-[21px] leading-none text-ink">
            {currentWeight ?? "—"}
          </div>
          <div className="mt-1 font-mono text-[10px] text-phase">
            {weightDelta == null ? "нет данных" : `${weightDelta < 0 ? "" : "+"}${weightDelta} кг`}
          </div>
        </Link>
        <Link href="/insights" className="flex-1 border-r border-line px-3 py-3.5 active:bg-surface-2">
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3">мигрень</div>
          <div className="mt-1.5 font-mono font-semibold text-[21px] leading-none text-ink">
            {triptan}
            <span className="text-[12px] font-normal text-ink-3">/{MIGRAINE.triptanThreshold}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-ink-3">
            {triptanHigh ? "близко к порогу" : "в норме"}
          </div>
        </Link>
        <Link href="/habits" className="flex-1 px-3 py-3.5 active:bg-surface-2">
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3">привычки</div>
          <div className="mt-1.5 font-mono font-semibold text-[21px] leading-none text-ink">
            {habitsDoneToday}
            <span className="text-[12px] font-normal text-ink-3">/{totalHabits}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-ink-3">
            {monthPct > 0 ? `${monthPct}% за мес` : "сегодня"}
          </div>
        </Link>
      </div>

      {/* ── Карточка мигрени ── */}
      <Link
        href="/insights"
        className="mt-3.5 block rounded-card border border-line bg-surface p-4 active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            мигрень · суматриптан
          </div>
          {c.inMigraineWindow ? (
            <span className="animate-pulse font-mono text-[9px] tracking-[0.08em] uppercase bg-phase px-[7px] py-[3px] text-on-phase">
              окно риска
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <div className={`font-mono font-semibold text-[30px] leading-none ${triptanHigh ? "text-warn" : "text-ink"}`}>
            {triptan}
            <span className="text-[13px] font-normal text-ink-2"> / {MIGRAINE.triptanThreshold} дней</span>
          </div>
          <div className={`font-mono text-[10px] ${triptanHigh ? "text-warn" : "text-ink-3"}`}>
            {triptanHigh ? "близко к порогу МИГБ" : "порог МИГБ"}
          </div>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-[1px] bg-surface-3">
          <div className={`h-full ${triptanHigh ? "bg-warn" : "bg-phase"}`} style={{ width: `${tiptanPct}%` }} />
        </div>
        <p className="mt-2.5 text-[12px] leading-[1.5] text-ink-2">
          {c.inMigraineWindow
            ? "Перименструальное окно — следи за сном и не пропускай еду."
            : triptanHigh
            ? "Приём триптана участился. Стоит обсудить профилактику с неврологом."
            : "Держишься ниже порога. Пики ~8 — обсуди профилактику с неврологом."}{" "}
          <span className="font-semibold text-phase-deep">инсайты →</span>
        </p>
      </Link>

      {/* ── Вес + Директива ── */}
      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <Link
          href="/weight"
          className="block rounded-card border border-line bg-surface p-4 active:scale-[0.99]"
        >
          <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">вес</div>
          <div className="mt-1.5 font-mono font-semibold leading-none text-[26px] text-ink">
            {currentWeight ?? "—"}
            <span className="text-[12px] font-normal text-ink-2"> кг</span>
          </div>
          <svg
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            className="mt-2 h-[28px] w-full"
          >
            <polyline
              points={spark}
              fill="none"
              stroke="var(--phase)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-1.5 font-mono text-[10px] text-phase-deep">
            {weightDelta == null ? "введи вес →" : `${weightDelta < 0 ? "" : "+"}${weightDelta} · цель ${weightGoalKg}`}
          </div>
        </Link>

        <Link
          href="/training"
          className="block rounded-card border border-line bg-surface p-4 active:scale-[0.99]"
          style={{ borderLeft: "3px solid var(--phase)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">
            тренинг · фаза
          </div>
          <div className="mt-2 font-sans font-bold text-[14px] leading-[1.2] text-ink">
            {tip.title}
          </div>
          <p className="mt-1.5 font-sans text-[11.5px] leading-[1.5] text-ink-2">{tip.text}</p>
        </Link>
      </div>

      {/* ── Расписание недели ── */}
      <Link
        href="/training/schedule"
        className="mt-3.5 block rounded-card border border-line bg-surface p-4 active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            расписание недели
          </div>
          <span className="font-mono text-[13px] text-phase">→</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {weekDates.map((iso, i) => {
            const dayEvents = eventsByDate.get(iso) ?? [];
            const dayNum = parseInt(iso.slice(8), 10);
            const isToday = iso === todayStr;
            return (
              <div key={iso} className="flex flex-col items-center gap-1">
                <span className="font-mono text-[9px] uppercase text-ink-3">{DOW_SHORT[i]}</span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] ${
                    isToday ? "bg-phase font-semibold text-on-phase" : "text-ink-2"
                  }`}
                >
                  {dayNum}
                </span>
                <div className="flex h-[4px] gap-[2px]">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className="h-[4px] w-[4px] shrink-0 rounded-full"
                      style={{ background: WEEK_TYPE_COLORS[ev.type] ?? "var(--ink-3)" }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Link>

      {/* ── Колесо баланса ── */}
      <Link
        href="/balance"
        className="mt-3.5 flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3.5 active:scale-[0.99]"
      >
        <div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            колесо баланса
          </div>
          <div className="mt-1 font-sans text-[13px] text-ink-2">
            колесо жизни
          </div>
        </div>
        <span className="font-mono text-[13px] text-phase">→</span>
      </Link>

      {/* ── RingConn ── */}
      {latestWearable && (
        <Link
          href="/wearable"
          className="mt-3.5 flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3.5 active:scale-[0.99]"
        >
          <div>
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
              ringconn · {latestWearable.date.slice(5)}
            </div>
            <div className="mt-1.5 flex items-baseline gap-4">
              <div>
                <span className="font-mono text-[11px] text-ink-3">HRV </span>
                <span className="font-mono font-semibold text-[17px] text-phase">{latestWearable.hrv_avg}</span>
              </div>
              <div>
                <span className="font-mono text-[11px] text-ink-3">ЧСС </span>
                <span className="font-mono font-semibold text-[17px] text-ink">{latestWearable.hr_resting}</span>
              </div>
              <div>
                <span className="font-mono text-[11px] text-ink-3">шаги </span>
                <span className="font-mono font-semibold text-[17px] text-ink">
                  {latestWearable.steps != null
                    ? latestWearable.steps >= 1000
                      ? `${(latestWearable.steps / 1000).toFixed(1)}к`
                      : String(latestWearable.steps)
                    : "—"}
                </span>
              </div>
            </div>
          </div>
          <span className="font-mono text-[13px] text-phase">→</span>
        </Link>
      )}

      {/* ── ЧЕК-ИН ── */}
      <Link
        href="/checkin"
        className="mt-3.5 block w-full rounded-card bg-phase py-4 text-center font-mono font-semibold text-[13px] tracking-[0.12em] uppercase text-on-phase active:scale-[0.99]"
      >
        заполнить чек-ин →
      </Link>
    </>
  );
}
