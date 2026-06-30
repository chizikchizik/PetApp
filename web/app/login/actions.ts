"use server";

import { redirect } from "next/navigation";
import { loginUser, setAuthCookie } from "@/lib/auth";
import { cookies } from "next/headers";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const pw = String(formData.get("password") || "");

  // Legacy single-password login (empty email)
  if (!email) {
    const expected = process.env.PETAPP_PASSWORD;
    if (!expected || pw !== expected) redirect("/login?e=1");
    const cookieStore = await cookies();
    cookieStore.set("verta_auth", pw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });
    redirect("/");
  }

  // Email + password login
  const user = await loginUser(email, pw);
  if (!user) redirect("/login?e=1");
  await setAuthCookie(user.id);
  redirect("/");
}
