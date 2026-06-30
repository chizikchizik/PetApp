import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0B0D",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          <div style={{ fontSize: 100, fontWeight: 800, color: "#E7E5DF", lineHeight: 1 }}>
            В
          </div>
          <div
            style={{
              width: 38,
              height: 3,
              background: "#d04830",
              borderRadius: 2,
              marginTop: -8,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
