import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Защита всего сайта паролем (cookie). Включается, только если задан
// PETAPP_PASSWORD (на Vercel). Локально без него — гейта нет.
export function proxy(request: NextRequest) {
  const expected = process.env.PETAPP_PASSWORD;
  if (!expected) return NextResponse.next();

  if (request.nextUrl.pathname === "/login") return NextResponse.next();

  const cookie = request.cookies.get("verta_auth")?.value;
  if (cookie === expected) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
