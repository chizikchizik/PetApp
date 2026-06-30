import { login } from "./actions";

// Lynx mascot geometry from VERTA design system
// viewBox "0 0 200 200"
const EDGES: [number, number, number, number, number][] = [
  // [x1, y1, x2, y2, pathLength]
  [58, 26, 52, 12, 15.2],   // left ear tip
  [142, 26, 148, 12, 15.2], // right ear tip
  [46, 84, 58, 26, 59.2],   // left ear outer
  [142, 26, 154, 84, 59.2], // right ear outer
  [58, 26, 84, 74, 54.6],   // left ear to head
  [116, 74, 142, 26, 54.6], // right ear to head
  [84, 74, 100, 58, 22.6],  // head top left
  [100, 58, 116, 74, 22.6], // head top right
  [46, 84, 48, 128, 44.0],  // left side
  [152, 128, 154, 84, 44.0],// right side
  [48, 128, 68, 160, 37.7], // left jaw
  [132, 160, 152, 128, 37.7],// right jaw
  [68, 160, 100, 182, 38.8],// chin left
  [100, 182, 132, 160, 38.8],// chin right
  [100, 58, 100, 128, 70.0], // center vertical
  [84, 74, 82, 104, 30.1],  // left brow
  [116, 74, 118, 104, 30.1],// right brow
  [48, 128, 82, 104, 41.6], // left diagonal
  [152, 128, 118, 104, 41.6],// right diagonal
  [82, 104, 100, 128, 30.0],// left cheek
  [118, 104, 100, 128, 30.0],// right cheek
  [100, 128, 100, 182, 54.0],// chin to bottom
];

const SMALL_DOTS: [number, number][] = [
  [58,26],[142,26],[46,84],[154,84],
  [84,74],[116,74],[100,58],
  [48,128],[152,128],
  [68,160],[132,160],[100,182],
];
const EYE_L = [82, 104];
const EYE_R = [118, 104];
const CHIN_DOT = [100, 128];

const EDGE_DELAY_START = 0.05; // s
const EDGE_STEP = 0.055;       // s between edges
const DOT_DELAY_START = EDGE_DELAY_START + EDGES.length * EDGE_STEP + 0.15;
const FLOAT_DELAY = DOT_DELAY_START + 0.8; // float starts after everything draws

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;

  return (
    <main className="phase-follicular mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center px-6">
      <style>{`
        @keyframes lynxDraw { to { stroke-dashoffset: 0; } }
        @keyframes lynxDotIn {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes eyePulse {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.18); }
        }
        @keyframes lynxFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        .lynx-dot {
          transform-box: fill-box;
          transform-origin: center;
        }
      `}</style>

      {/* ── Маскот ── */}
      <div
        style={{
          animation: `lynxFloat 3.8s ease-in-out ${FLOAT_DELAY.toFixed(2)}s infinite`,
        }}
      >
        <svg
          viewBox="0 0 200 200"
          width="180"
          height="180"
          aria-hidden="true"
        >
          {/* Рёбра — рисуются по одному */}
          <g strokeLinecap="round" strokeOpacity="0.75">
            {EDGES.map(([x1, y1, x2, y2, len], i) => (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="var(--phase)"
                strokeWidth="1.5"
                strokeDasharray={len}
                strokeDashoffset={len}
                style={{
                  animation: `lynxDraw 0.32s ease-out ${(EDGE_DELAY_START + i * EDGE_STEP).toFixed(3)}s forwards`,
                }}
              />
            ))}
          </g>

          {/* Маленькие узловые точки */}
          <g fill="var(--phase)">
            {SMALL_DOTS.map(([cx, cy], i) => (
              <circle
                key={i}
                className="lynx-dot"
                cx={cx} cy={cy} r={2.6}
                style={{
                  opacity: 0,
                  animation: `lynxDotIn 0.22s ease-out ${(DOT_DELAY_START + i * 0.04).toFixed(3)}s forwards`,
                }}
              />
            ))}

            {/* Глаза — пульсируют */}
            {[EYE_L, EYE_R].map(([cx, cy], i) => (
              <circle
                key={`eye-${i}`}
                className="lynx-dot"
                cx={cx} cy={cy} r={5.2}
                style={{
                  opacity: 0,
                  animation: [
                    `lynxDotIn 0.28s ease-out ${(DOT_DELAY_START + SMALL_DOTS.length * 0.04 + i * 0.06).toFixed(3)}s forwards`,
                    `eyePulse 2.6s ease-in-out ${(FLOAT_DELAY + 0.2 + i * 0.15).toFixed(2)}s infinite`,
                  ].join(", "),
                }}
              />
            ))}

            {/* Подбородок */}
            <circle
              className="lynx-dot"
              cx={CHIN_DOT[0]} cy={CHIN_DOT[1]} r={3.4}
              style={{
                opacity: 0,
                animation: `lynxDotIn 0.22s ease-out ${(DOT_DELAY_START + (SMALL_DOTS.length + 2) * 0.04).toFixed(3)}s forwards`,
              }}
            />
          </g>
        </svg>
      </div>

      {/* ── Заголовок ── */}
      <div className="mt-5 text-center">
        <p className="font-serif font-bold text-[26px] tracking-[0.04em] text-ink">VERTA</p>
        <p className="mt-0.5 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-3">
          женский биохакинг
        </p>
      </div>

      <h1 className="mt-6 text-center font-serif text-[22px] font-bold uppercase leading-tight tracking-[0.02em] text-ink">
        С возвращением
      </h1>

      {/* ── Форма ── */}
      <form action={login} className="mt-6 w-full space-y-3">
        <input
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Пароль"
          className="w-full rounded-[3px] border border-line bg-surface px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
        {e === "1" && (
          <p className="text-[13px] font-medium text-warn">Неверный пароль</p>
        )}
        <button
          type="submit"
          className="w-full rounded-[3px] bg-phase py-4 text-[15px] font-semibold text-on-phase transition active:scale-[0.99]"
        >
          Войти
        </button>
      </form>
    </main>
  );
}
