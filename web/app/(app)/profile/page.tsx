import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

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
        weightGoalKg={user?.weightGoalKg ?? null}
        weightStartKg={user?.weightStartKg ?? null}
      />
    </>
  );
}
