"use server";

import { redirect } from "next/navigation";
import { loginUser, setAuthCookie } from "@/lib/auth";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const pw = String(formData.get("password") || "");

  // Вход только по email и паролю. Вход по общему мастер-паролю (пустой
  // email) убран: он открывал первый аккаунт без email (решение Марины, 2026-11-23).
  if (!email || !pw) redirect("/login?e=3");

  // Email + password login
  const result = await loginUser(email, pw);
  if ("error" in result) {
    redirect(result.error === "not_found" ? "/login?e=2" : "/login?e=1");
  }
  await setAuthCookie(result.user.id);
  redirect("/");
}
