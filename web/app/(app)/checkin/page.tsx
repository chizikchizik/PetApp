import Link from "next/link";
import { CheckinForm } from "./checkin-form";
import { getCurrentCycle, PHASE_LABELS } from "@/lib/cycle";
import { getPeriodStarts, getDailyLog, getHabits, getMeds, getCurrentWeight, getMedMonthlyCounts, getMigraineTriggers, getSportTypes, getQuickPainEntries } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";

const MONTH_SHORT = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"];
const WEEKDAY_SHORT = ["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"];
function fmtDateMono(d: Date) {
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export const dynamic = "force-dynamic";

export default async function CheckIn({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const todayISO = todayISOMoscow();
  const today = new Date(todayISO + "T12:00:00");
  const dayKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO;
  const isToday = dayKey === todayISO;
  const targetDate = new Date(dayKey + "T12:00:00");

  const [starts, initial, habits, meds, weight, user, medCounts, triggers, sportTypes, todayQuickPain] = await Promise.all([
    getPeriodStarts(),
    getDailyLog(dayKey),
    getHabits(todayISO.slice(0, 7)),
    getMeds(),
    getCurrentWeight(),
    getCurrentUser(),
    getMedMonthlyCounts(dayKey.slice(0, 7)),
    getMigraineTriggers(),
    getSportTypes(),
    getQuickPainEntries(dayKey, dayKey),
  ]);
  const c = getCurrentCycle(starts, targetDate, user?.avgCycleLength ?? 28, user?.menstrualDays ?? 5);

  // layout.tsx sets the phase-${phase} CSS class root-wide based on TODAY —
  // it can't see this page's own ?date= param. When viewing a different day,
  // re-scope the phase CSS variables locally so the color accent actually
  // matches the phase label shown in the text below (was a real mismatch:
  // text said e.g. "Фолликулярная", but buttons/highlights stayed in today's
  // phase color, since only the root layout class controlled --phase).
  return (
    <div className={!isToday ? `phase-${c.phase}` : undefined}>
      <header>
        <Link
          href="/dashboard"
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
        >
          ← дашборд
        </Link>
        <h1 className="mt-3 font-serif font-bold text-[23px] uppercase leading-[1.05]">
          {isToday ? <>КАК ТЫ<br />СЕГОДНЯ?</> : fmtDateMono(targetDate)}
        </h1>
        <p className="mt-2 font-mono text-[11px] text-phase">
          {fmtDateMono(isToday ? today : targetDate)} · {PHASE_LABELS[c.phase]} фаза
        </p>
      </header>

      <Link
        href="/cycle"
        className="mt-2 block font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3 underline underline-offset-2"
      >
        управлять циклом →
      </Link>

      <CheckinForm
        dayKey={dayKey}
        todayISO={todayISO}
        initial={initial}
        habits={habits}
        meds={meds}
        weightPlaceholder={weight}
        medCounts={medCounts}
        triggers={triggers}
        sportTypes={sportTypes}
        todayQuickPain={todayQuickPain}
      />
    </div>
  );
}
