"use client";
import type { Scores } from "./actions";

const N = 8;

const SEGMENTS: { key: keyof Scores; label: string }[] = [
  { key: "family",  label: "Семья"       },
  { key: "work",    label: "Работа"      },
  { key: "rest",    label: "Отдых"       },
  { key: "health",  label: "Здоровье"    },
  { key: "friends", label: "Дружба"      },
  { key: "money",   label: "Деньги"      },
  { key: "spirit",  label: "Духовность"  },
  { key: "growth",  label: "Рост"        },
];

const CX = 155;
const CY = 155;
const MAX_R = 100;
const LABEL_R = 130;

function angle(i: number) {
  return -Math.PI / 2 + (i * 2 * Math.PI) / N;
}

function polarXY(r: number, a: number) {
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function gridPoints(r: number): string {
  return SEGMENTS.map((_, i) => {
    const { x, y } = polarXY(r, angle(i));
    return `${x},${y}`;
  }).join(" ");
}

function dataPoints(scores: Scores): string {
  return SEGMENTS.map((s, i) => {
    const v = Math.max(1, Math.min(10, scores[s.key] ?? 1));
    const { x, y } = polarXY((v / 10) * MAX_R, angle(i));
    return `${x},${y}`;
  }).join(" ");
}

export function WheelSvg({ scores, prev }: { scores: Scores; prev?: Scores }) {
  const grids = [2, 4, 6, 8, 10];

  return (
    // viewBox extended left/right to give labels room outside the octagon
    <svg viewBox="-60 -20 430 360" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[340px]">
      {/* Grid octagons */}
      {grids.map((g) => (
        <polygon
          key={g}
          points={gridPoints((g / 10) * MAX_R)}
          fill="none"
          stroke="var(--line)"
          strokeWidth={g === 10 ? 1 : 0.5}
        />
      ))}

      {/* Axis lines */}
      {SEGMENTS.map((_, i) => {
        const outer = polarXY(MAX_R, angle(i));
        return (
          <line
            key={i}
            x1={CX} y1={CY}
            x2={outer.x} y2={outer.y}
            stroke="var(--line)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Previous scores (ghost) */}
      {prev && (
        <polygon
          points={dataPoints(prev)}
          fill="var(--phase)"
          fillOpacity={0.1}
          stroke="var(--phase)"
          strokeWidth={1}
          strokeOpacity={0.3}
          strokeDasharray="3 2"
        />
      )}

      {/* Current scores */}
      <polygon
        points={dataPoints(scores)}
        fill="var(--phase)"
        fillOpacity={0.28}
        stroke="var(--phase)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Score dots */}
      {SEGMENTS.map((s, i) => {
        const v = Math.max(1, Math.min(10, scores[s.key] ?? 1));
        const { x, y } = polarXY((v / 10) * MAX_R, angle(i));
        return (
          <circle key={s.key} cx={x} cy={y} r={3.5} fill="var(--phase)" />
        );
      })}

      {/* Grid labels (2, 4, 6, 8) on top axis */}
      {[2, 4, 6, 8].map((g) => {
        const { x, y } = polarXY((g / 10) * MAX_R, -Math.PI / 2);
        return (
          <text key={g} x={x + 4} y={y + 3} fontSize={7} fill="var(--ink-4)" fontFamily="JetBrains Mono, monospace">
            {g}
          </text>
        );
      })}

      {/* Segment labels */}
      {SEGMENTS.map((s, i) => {
        const a = angle(i);
        const { x, y } = polarXY(LABEL_R, a);
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        const anchor =
          Math.abs(cosA) < 0.2 ? "middle"
          : cosA > 0 ? "start"
          : "end";
        // vertical nudge: push up at top, down at bottom, center otherwise
        const dy = sinA < -0.3 ? -7 : sinA > 0.3 ? 13 : 4;
        const v = scores[s.key] ?? 5;
        return (
          <g key={s.key}>
            <text
              x={x} y={y + dy - 6}
              textAnchor={anchor}
              fontSize={9}
              fontWeight="600"
              fill="var(--ink)"
              fontFamily="Manrope, sans-serif"
            >
              {s.label}
            </text>
            <text
              x={x} y={y + dy + 5}
              textAnchor={anchor}
              fontSize={7.5}
              fill="var(--ink-3)"
              fontFamily="Manrope, sans-serif"
            >
              {v}/10
            </text>
          </g>
        );
      })}
    </svg>
  );
}
