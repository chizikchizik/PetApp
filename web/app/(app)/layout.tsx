import { getCurrentCycle } from "@/lib/cycle";
import { getPeriodStarts } from "@/lib/data";
import { BottomNav } from "@/components/bottom-nav";

// Экраны читают живые данные из БД на каждый запрос (не статический снапшот).
export const dynamic = "force-dynamic";

// Общий шелл экранов: мобильная ширина + нижняя навигация.
// Класс фазы цикла задаёт акцентный цвет всему поддереву.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { phase } = getCurrentCycle(await getPeriodStarts());
  return (
    <div className={`phase-${phase} mx-auto flex min-h-dvh max-w-[430px] flex-col`}>
      <div className="flex-1 px-5 pb-28" style={{ paddingTop: "max(1.75rem, env(safe-area-inset-top))" }}>{children}</div>
      <BottomNav />
    </div>
  );
}
