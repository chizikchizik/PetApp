import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMigreDiaryMonth } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // proxy пропускает любой cookie в формате UUID — проверяем, что это реальный
  // пользователь (QA раунд 8, P1-1).
  const user = await getCurrentUser();
  if (!user || user.id === "__legacy__") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ym = req.nextUrl.searchParams.get("ym");
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "ym required (YYYY-MM)" }, { status: 400 });
  }
  const diary = await getMigreDiaryMonth(ym);
  return NextResponse.json(diary);
}
