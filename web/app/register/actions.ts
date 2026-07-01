"use server";

import { redirect } from "next/navigation";
import { createUser, setAuthCookie, deleteUnfinishedUser } from "@/lib/auth";

export async function register(formData: FormData) {
  const displayName = String(formData.get("displayName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (password.length < 8) redirect("/register?e=3");

  // All business logic runs here, contained in try/catch. redirect() itself is
  // called exactly once, at the end, outside any catch — so it can never be
  // swallowed by a catch block (redirect() throws NEXT_REDIRECT internally).
  let target = "/onboarding";

  try {
    const user = await createUser(email, password, displayName || "Пользователь");
    await setAuthCookie(user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("уже зарегистрирован")) {
      // Если онбординг не был завершён — удаляем незавершённый аккаунт и регистрируем заново
      try {
        await deleteUnfinishedUser(email);
        const fresh = await createUser(email, password, displayName || "Пользователь");
        await setAuthCookie(fresh.id);
      } catch {
        // Аккаунт существует и онбординг завершён — предлагаем войти
        target = "/register?e=2";
      }
    } else {
      target = "/register?e=2";
    }
  }

  redirect(target);
}
