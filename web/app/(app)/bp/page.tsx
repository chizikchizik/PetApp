import { BackLink } from "@/components/back-link";
import { getBpReadings } from "@/lib/data";
import { getCurrentUser, isPregnant } from "@/lib/auth";
import { todayISOMoscow, isoDaysFromTodayMoscow } from "@/lib/format";
import { BpTracker } from "./bp-tracker";
import { BpChart } from "./bp-chart";

export const dynamic = "force-dynamic";

export default async function BpPage() {
  const todayISO = todayISOMoscow();
  const [readings, user] = await Promise.all([
    getBpReadings(isoDaysFromTodayMoscow(-90)),
    getCurrentUser(),
  ]);
  const pregnant = isPregnant(user);
  const chartFrom = isoDaysFromTodayMoscow(-30);

  return (
    <>
      <BackLink href="/profile" label="← назад" />
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">ДАВЛЕНИЕ</h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">
        артериальное · утро и вечер · дневник для врача
      </p>

      <BpTracker readings={readings} todayISO={todayISO} pregnant={pregnant} />

      {readings.filter((r) => r.date >= chartFrom).length >= 2 && (
        <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">
            тренд · 30 дней
          </p>
          <div className="mt-3">
            <BpChart
              readings={readings
                .filter((r) => r.date >= chartFrom)
                .map((r) => ({ date: r.date, slot: r.slot, systolic: r.systolic, diastolic: r.diastolic }))}
              fromISO={chartFrom}
              toISO={todayISO}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[11px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--ink)" }} /> верхнее
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--ink-3)" }} /> нижнее
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ borderColor: "var(--ink-2)" }} /> вечер (контур)
            </span>
          </div>
        </section>
      )}

      <p className="mt-3 font-sans text-[11.5px] leading-relaxed text-ink-3">
        VERTA не ставит диагнозы. Это дневник наблюдений для тебя и твоего врача.
      </p>
    </>
  );
}
