import Link from "next/link";
import { getCurrentUser, isPregnant } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { PregnancyToggle } from "./pregnancy-toggle";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  return (
    <>
      {/* ── Шапка ── */}
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase leading-tight">
        ПРОФИЛЬ
      </h1>
      {user?.email && (
        <div className="mt-1.5 font-mono text-[11px] text-ink-3">{user.email}</div>
      )}

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

      <PregnancyToggle active={isPregnant(user)} />

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
