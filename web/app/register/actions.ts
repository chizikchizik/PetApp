"use server";

import { redirect } from "next/navigation";
import { createUser, setAuthCookie, deleteUnfinishedUser } from "@/lib/auth";

export async function register(formData: FormData) {
  const displayName = String(formData.get("displayName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (password.length < 8) redirect("/register?e=3");

  try {
    const user = await createUser(email, password, displayName || "Пользователь");
    await setAuthCookie(user.id);
    redirect("/onboarding");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("уже зарегистрирован")) {
      // Если онбординг не был завершён — удаляем незавершённый аккаунт и регистрируем заново
      await deleteUnfinishedUser(email);
      try {
        const fresh = await createUser(email, password, displayName || "Пользователь");
        await setAuthCookie(fresh.id);
        redirect("/onboarding");
      } catch {
        // Аккаунт существует и онбординг завершён — предлагаем войти
        redirect("/register?e=2");
      }
    }
    redirect("/register?e=2");
  }
}
