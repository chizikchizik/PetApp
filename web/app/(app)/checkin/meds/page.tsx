import Link from "next/link";
import { getAllMeds, getMedIntakeDays, getQuickPainEntries } from "@/lib/data";
import { todayISOMoscow } from "@/lib/format";
import { MedCalendar } from "./med-calendar";

export const dynamic = "force-dynamic";

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export default async function MedsPage({
  searchParams,
}: {
  searchParams: Promise<{ end?: string }>;
}) {
  const sp = await searchParams;
  const todayISO = todayISOMoscow();
  const endISO   = sp.end && /^\d{4}-\d{2}-\d{2}$/.test(sp.end) ? sp.end : todayISO;
  const fromISO  = addMonths(endISO, -3);

  const isLatest = endISO >= todayISO;
  const prevEnd  = addMonths(endISO, -3);
  const nextEnd  = addMonths(endISO, 3);
  const nextEnd2 = nextEnd > todayISO ? todayISO : nextEnd;

  const [meds, intakeDays, quickPainEntries] = await Promise.all([
    getAllMeds(),
    getMedIntakeDays(fromISO, endISO),
    getQuickPainEntries(fromISO, endISO),
  ]);

  const fromLabel = fromISO.slice(0, 7).replace("-", ".");
  const toLabel   = endISO.slice(0, 7).replace("-", ".");

  return (
    <>
      <Link href="/checkin" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        ← чек-ин
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        ПРЕПАРАТЫ
      </h1>

      {/* Navigation */}
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/checkin/meds?end=${prevEnd}`}
          className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line font-mono text-[13px] text-ink-2 transition active:bg-surface-3"
        >
          ←
        </Link>
        <span className="flex-1 text-center font-mono text-[11px] text-ink-2">
          {fromLabel} — {toLabel}
        </span>
        {!isLatest ? (
          <Link
            href={`/checkin/meds?end=${nextEnd2}`}
            className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line font-mono text-[13px] text-ink-2 transition active:bg-surface-3"
          >
            →
          </Link>
        ) : (
          <div className="h-7 w-7" />
        )}
      </div>

      <div className="mt-4">
        <MedCalendar
          meds={meds}
          intakeDays={intakeDays}
          fromISO={fromISO}
          todayISO={endISO}
          quickPainEntries={quickPainEntries}
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
