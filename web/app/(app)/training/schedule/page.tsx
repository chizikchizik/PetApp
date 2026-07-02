import { getCalendarEvents } from "./actions";
import { ScheduleCalendar } from "./schedule-calendar";
import { BackLink } from "@/components/back-link";
import { isoLocal, nowMoscow } from "@/lib/format";

export const dynamic = "force-dynamic";

function isoMonday(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return isoLocal(d);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

export default async function SchedulePage() {
  const now   = nowMoscow();
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based

  const firstMonday = isoMonday(year, month);
  const lastDay     = addDays(firstMonday, 6 * 7 - 1);

  const events = await getCalendarEvents(firstMonday, lastDay);

  return (
    <>
      <BackLink href="/training" label="← назад" />
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
