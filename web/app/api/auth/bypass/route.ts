import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p") ?? "";
  const expected = process.env.PETAPP_PASSWORD ?? "";

  if (!expected) {
    return NextResponse.json({ error: "PETAPP_PASSWORD not set on Vercel" }, { status: 500 });
  }

  if (p !== expected) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("verta_auth", p, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}
