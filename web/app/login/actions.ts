"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const pw = String(formData.get("password") || "");
  const expected = process.env.PETAPP_PASSWORD;

  if (!expected || pw !== expected) {
    redirect("/login?e=1");
  }

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
