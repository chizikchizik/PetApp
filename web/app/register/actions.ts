"use server";

import { redirect } from "next/navigation";
import { createUser, setAuthCookie } from "@/lib/auth";

export async function register(formData: FormData) {
  const displayName = String(formData.get("displayName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const inviteCode = String(formData.get("inviteCode") || "").trim();

  // Validate invite code if required
  const expectedCode = process.env.PETAPP_INVITE_CODE;
  if (expectedCode && inviteCode !== expectedCode) redirect("/register?e=1");

  // Validate password
  if (password.length < 8) redirect("/register?e=3");

  try {
    const user = await createUser(email, password, displayName || "Пользователь");
    await setAuthCookie(user.id);
    redirect("/onboarding");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("уже зарегистрирован")) redirect("/register?e=2");
    redirect("/register?e=2");
  }
}
