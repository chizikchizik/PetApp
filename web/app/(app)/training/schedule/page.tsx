import Link from "next/link";
import { getCalendarEvents } from "./actions";
import { ScheduleCalendar } from "./schedule-calendar";

export const dynamic = "force-dynamic";

function isoMonday(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function SchedulePage() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-based

  const firstMonday = isoMonday(year, month);
  const lastDay     = addDays(firstMonday, 6 * 7 - 1);

  const events = await getCalendarEvents(firstMonday, lastDay);

  return (
    <>
      <Link href="/training" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        ← тренинг
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        РАСПИСАНИЕ
      </h1>
      <p className="mt-1 font-mono text-[11px] text-ink-2">
        тренировки · события · напоминания
      </p>

      <div className="mt-5">
        <ScheduleCalendar
          initialEvents={events}
          initialYear={year}
          initialMonth={month}
        />
      </div>
    </>
  );
}
