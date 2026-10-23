import Link from "next/link";
import { getCurrentUser, isPregnant } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileForm } from "./profile-form";
import { PregnancyToggle } from "./pregnancy-toggle";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

// Профиль — точка входа в редкие разделы, которые не попали в нижнее меню
// (там только Сегодня / Мигрень / Тренировки / Вес).
function SectionLink({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[48px] items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 active:bg-surface-2"
    >
      <span className="min-w-0">
        <span className="block font-sans text-[14px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block font-sans text-[12px] text-ink-2">{hint}</span>
      </span>
      <span className="shrink-0 font-mono text-[13px] text-phase">→</span>
    </Link>
  );
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const pregnant = isPregnant(user);

  return (
    <>
      {/* ── Шапка ── */}
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← сегодня
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        ПРОФИЛЬ
      </h1>
      {user?.email && (
        <div className="mt-1.5 font-mono text-[11px] text-ink-3">{user.email}</div>
      )}

      {/* ── Разделы ── */}
      <nav aria-label="Разделы" className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        <SectionLink href="/cycle" title="Цикл и месячные" hint="календарь, отметки начала цикла" />
        <SectionLink href="/checkin/meds" title="Препараты" hint="график приёма, типы препаратов" />
        {pregnant && (
          <SectionLink href="/bp" title="Дневник давления" hint="утро и вечер, для врача" />
        )}
        <SectionLink href="/import/migrebot" title="Импорт из MigreBot" hint="загрузить историю приступов" />
        <SectionLink href="/wearable" title="Кольцо RingConn" hint="сон, пульс, HRV" />
      </nav>

      <ProfileForm
        displayName={user?.displayName ?? ""}
        avgCycleLength={user?.avgCycleLength ?? null}
        menstrualDays={user?.menstrualDays ?? null}
        weightGoalKg={user?.weightGoalKg ?? null}
        weightStartKg={user?.weightStartKg ?? null}
        workoutYearGoal={user?.workoutYearGoal ?? null}
        calorieBalanceKcal={user?.calorieBalanceKcal ?? null}
        calorieGoalKcal={user?.calorieGoalKcal ?? null}
      />

      <PregnancyToggle active={pregnant} />

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
        <div>
          <div className="font-sans text-[14px] font-semibold text-ink">Тема</div>
          <p className="mt-1 font-sans text-[12px] text-ink-2">светлая или тёмная</p>
        </div>
        <ThemeToggle />
      </div>

      <form action={logout} className="mt-8 border-t border-line pt-5">
        <button
          type="submit"
          className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-3 transition hover:text-ink-2"
        >
          Выйти из аккаунта
        </button>
      </form>
    </>
  );
}
