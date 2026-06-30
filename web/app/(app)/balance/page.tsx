import Link from "next/link";
import { getAssessments } from "./actions";
import { BalanceForm } from "./balance-form";

export const dynamic = "force-dynamic";

export default async function BalancePage() {
  const assessments = await getAssessments();

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
        8 сфер · колесо жизни · ironby
      </p>

      <div className="mt-3 rounded-card border border-line bg-surface-2 px-3.5 py-2.5 font-sans text-[11.5px] leading-relaxed text-ink-2">
        Оцени каждую сферу честно. Проблемные зоны станут фокусом работы.
      </div>

      <BalanceForm assessments={assessments} />
    </>
  );
}
