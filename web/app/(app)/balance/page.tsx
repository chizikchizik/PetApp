import Link from "next/link";
import { getAssessments, getSectors } from "./actions";
import { BalanceForm } from "./balance-form";

export const dynamic = "force-dynamic";

export default async function BalancePage() {
  const [assessments, sectors] = await Promise.all([getAssessments(), getSectors()]);

  return (
    <>
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        КОЛЕСО БАЛАНСА
      </h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">
        {sectors.length} {sectors.length === 1 ? "сфера" : sectors.length < 5 ? "сферы" : "сфер"} · колесо жизни
      </p>

      <div className="mt-3 rounded-card border border-line bg-surface-2 px-3.5 py-2.5 font-sans text-[11.5px] leading-relaxed text-ink-2">
        Оцени каждую сферу честно. Проблемные зоны станут фокусом работы.
      </div>

      <BalanceForm sectors={sectors} assessments={assessments} />
    </>
  );
}
