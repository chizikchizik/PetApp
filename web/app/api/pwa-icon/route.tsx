import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { LynxBadge, LYNX_BG } from "@/lib/lynx-mark";

// Иконка PWA-инсталляции (manifest.ts icons[]) — маскот "Рысь".
// Отдельно от /icon (favicon вкладки браузера, остаётся кольцом с V) —
// см. proxy.ts, этот путь тоже должен быть в исключениях auth-гейта.
export async function GET(req: NextRequest) {
  const size = Number(req.nextUrl.searchParams.get("size")) || 512;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: LYNX_BG }}>
        <LynxBadge />
      </div>
    ),
    { width: size, height: size },
  );
}
