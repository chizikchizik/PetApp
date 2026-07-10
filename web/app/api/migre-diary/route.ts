import { NextRequest, NextResponse } from "next/server";
import { getMigreDiaryMonth } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ym = req.nextUrl.searchParams.get("ym");
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "ym required (YYYY-MM)" }, { status: 400 });
  }
  const diary = await getMigreDiaryMonth(ym);
  return NextResponse.json(diary);
}
