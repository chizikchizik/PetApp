import Link from "next/link";
import { getMeds, getMedIntakeDays } from "@/lib/data";
import { MedCalendar } from "./med-calendar";

export const dynamic = "force-dynamic";

export default async function MedsPage() {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  // 90 days back
  const from = new Date(today);
  from.setDate(from.getDate() - 89);
  const fromISO = from.toISOString().slice(0, 10);

  const [meds, intakeDays] = await Promise.all([
    getMeds(),
    getMedIntakeDays(fromISO, todayISO),
  ]);

  return (
    <>
      <Link href="/checkin" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        ← чек-ин
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        ПРЕПАРАТЫ
      </h1>
      <p className="mt-1 font-mono text-[11px] text-ink-2">
        график приёма · последние 90 дней
      </p>

      <div className="mt-5">
        <MedCalendar
          meds={meds}
          intakeDays={intakeDays}
          fromISO={fromISO}
          todayISO={todayISO}
        />
      </div>

      <div className="mt-6">
        <Link
          href="/checkin"
          className="block text-center font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3 underline underline-offset-2"
        >
          + отметить приём сегодня →
        </Link>
      </div>
    </>
  );
}
