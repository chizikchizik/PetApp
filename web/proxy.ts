import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Гейт всего сайта: без подписанной cookie сессии — на /login. Включается,
// только если задан PETAPP_PASSWORD (на Vercel); сам пароль больше не даёт
// входа (2026-11-23). Локально без него — гейта нет.
export async function proxy(request: NextRequest) {
  const expected = process.env.PETAPP_PASSWORD;
  if (!expected) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/register") || pathname.startsWith("/onboarding")) {
    return NextResponse.next();
  }

  // Старые cookie (голый id) не проходят: один раз войти заново.
  if (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon|apple-icon|manifest.webmanifest|api/pwa-icon).*)"],
};
