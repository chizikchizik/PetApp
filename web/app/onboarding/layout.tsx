import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Онбординг — только для вошедшей пользовательницы, которая его ещё не прошла.
// Повторный проход добавлял лишний старт цикла на сегодня (QA раунд 8).
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingDone) redirect("/dashboard");
  return children;
}
