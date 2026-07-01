import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Защита всего сайта паролем (cookie). Включается, только если задан
// PETAPP_PASSWORD (на Vercel). Локально без него — гейта нет.
export function proxy(request: NextRequest) {
  const expected = process.env.PETAPP_PASSWORD;
  if (!expected) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/register") || pathname.startsWith("/onboarding")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("verta_auth")?.value;
  const isLegacy = cookie === expected;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cookie ?? "");
  if (isLegacy || isUUID) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
