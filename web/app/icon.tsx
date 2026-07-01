import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// Из утверждённого дизайна: design/icons/VERTA - Иконка iPhone.dc.html
// Циферблат-кольцо (мотив цикла) + шеврон "V", акцент — фолликулярный зелёный.
const BG = "radial-gradient(120% 120% at 50% 0%, #17171A 0%, #0B0B0D 62%)";
const LINE = "#2A2A31";
const LINE_2 = "#3A3A43";
const ACCENT = "#9BEB60";

const TICKS = Array.from({ length: 36 }, (_, i) => {
  const ang = (i / 36) * 2 * Math.PI - Math.PI / 2;
  const hot = i < Math.round(36 * 0.78);
  const cx = 50, cy = 51, r1 = 32, r2 = 38;
  return {
    x1: cx + Math.cos(ang) * r1,
    y1: cy + Math.sin(ang) * r1,
    x2: cx + Math.cos(ang) * r2,
    y2: cy + Math.sin(ang) * r2,
    stroke: hot ? ACCENT : LINE_2,
    width: hot ? 1.3 : 0.95,
  };
});

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="50" cy="51" r="34" fill="none" stroke={LINE} strokeWidth={0.7} />
          {TICKS.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.stroke} strokeWidth={t.width} strokeLinecap="round" />
          ))}
          <polyline
            points="36.5,40 50,63 63.5,40"
            fill="none"
            stroke={ACCENT}
            strokeWidth={6}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <circle cx="50" cy="63" r="2.7" fill={ACCENT} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
