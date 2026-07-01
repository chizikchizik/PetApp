import { ImageResponse } from "next/og";
import { LynxBadge, LYNX_BG } from "@/lib/lynx-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS-иконка "На экран «Домой»" — маскот "Рысь" (вариант A, design/icons2).
// Вкладка браузера (icon.tsx) остаётся кольцом-циферблатом с шевроном V.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: LYNX_BG }}>
        <LynxBadge />
      </div>
    ),
    { ...size },
  );
}
