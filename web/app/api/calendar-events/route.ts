import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents } from "@/app/(app)/training/schedule/actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from and to are required (YYYY-MM-DD)" }, { status: 400 });
  }

  const events = await getCalendarEvents(from, to);
  return NextResponse.json(events);
}
