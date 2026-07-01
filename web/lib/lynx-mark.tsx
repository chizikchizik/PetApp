// Маскот "Рысь" — вариант A "рысь в кольце цикла" из
// design/icons2/VERTA - Иконка с маскотом.dc.html (badgeSVG()).
// Используется только для иконки установленного приложения
// (apple-icon.tsx, /pwa-icon) — вкладка браузера остаётся icon.tsx.

export const LYNX_BG = "radial-gradient(120% 120% at 50% 0%, #17171A 0%, #0B0B0D 62%)";
export const LYNX_ACCENT = "#9BE84B";

// Рёбра "созвездия" тела рыси (сырые координаты до translate(35,36) scale(0.66))
const FULL_E: [number, number, number, number][] = [
  [46, 84, 58, 26], [58, 26, 84, 74], [84, 74, 100, 58], [100, 58, 116, 74], [116, 74, 142, 26], [142, 26, 154, 84],
  [46, 84, 48, 128], [48, 128, 68, 160], [68, 160, 100, 182], [100, 182, 132, 160], [132, 160, 152, 128], [152, 128, 154, 84],
  [84, 74, 82, 104], [116, 74, 118, 104], [82, 104, 100, 128], [118, 104, 100, 128],
  [100, 58, 100, 128], [100, 128, 100, 182], [48, 128, 82, 104], [152, 128, 118, 104],
  [58, 26, 52, 12], [142, 26, 148, 12],
];
const FULL_S: [number, number][] = [
  [46, 84], [58, 26], [84, 74], [100, 58], [116, 74], [142, 26], [154, 84], [48, 128], [68, 160], [100, 182], [132, 160], [152, 128],
];

const TX = (x: number) => 35 + x * 0.66;
const TY = (y: number) => 36 + y * 0.66;

export const LYNX_EDGES = FULL_E.map(([x1, y1, x2, y2]) => ({
  x1: TX(x1), y1: TY(y1), x2: TX(x2), y2: TY(y2),
}));
export const LYNX_DOTS = FULL_S.map(([x, y]) => ({ x: TX(x), y: TY(y), r: 2.6 * 0.66 }));
export const LYNX_EYES = [
  { x: TX(82), y: TY(104), r: 5.4 * 0.66 },
  { x: TX(118), y: TY(104), r: 5.4 * 0.66 },
];
export const LYNX_NOSE = { x: TX(100), y: TY(128), r: 3.4 * 0.66 };

export const RING_TICKS = Array.from({ length: 48 }, (_, i) => {
  const a = (i / 48) * 2 * Math.PI;
  return {
    x1: 100 + Math.cos(a) * 86,
    y1: 100 + Math.sin(a) * 86,
    x2: 100 + Math.cos(a) * 94,
    y2: 100 + Math.sin(a) * 94,
  };
});

export function LynxBadge() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <circle cx="100" cy="100" r="94" fill="none" stroke="#2A2A31" strokeWidth={1} />
      {RING_TICKS.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#3A3A43" strokeWidth={1.4} strokeLinecap="round" />
      ))}
      {LYNX_EDGES.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={LYNX_ACCENT} strokeOpacity={0.6} strokeWidth={2 * 0.66} strokeLinecap="round" />
      ))}
      {LYNX_DOTS.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={LYNX_ACCENT} />
      ))}
      {LYNX_EYES.map((e, i) => (
        <circle key={i} cx={e.x} cy={e.y} r={e.r} fill={LYNX_ACCENT} />
      ))}
      <circle cx={LYNX_NOSE.x} cy={LYNX_NOSE.y} r={LYNX_NOSE.r} fill={LYNX_ACCENT} />
    </svg>
  );
}
