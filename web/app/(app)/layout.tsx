import { redirect } from "next/navigation";
import { getCurrentCycle } from "@/lib/cycle";
import { getPeriodStarts } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingDone) redirect("/onboarding");

  const today = new Date(todayISOMoscow() + "T12:00:00");
  const { phase } = getCurrentCycle(await getPeriodStarts(), today, user.avgCycleLength ?? 28);
  return (
    <div className={`phase-${phase} mx-auto flex min-h-dvh max-w-[430px] flex-col`}>
      <div className="flex-1 px-5 pb-28" style={{ paddingTop: "max(1.75rem, env(safe-area-inset-top))" }}>{children}</div>
      <BottomNav />
    </div>
  );
}
