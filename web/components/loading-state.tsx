"use client";

import { useEffect, useState } from "react";

type Variant = "dashboard" | "list" | "detail" | "form";

interface LoadingStateProps {
  variant?: Variant;
  /** Сколько строк-плейсхолдеров рисовать в variant="list" (по умолчанию 4) */
  rows?: number;
}

/**
 * Универсальный loading.tsx для App Router.
 * Не мигает на быстрых загрузках (<150мс) — контент монтируется скрытым и
 * появляется плавно только если загрузка реально заняла время.
 */
export function LoadingState({ variant = "list", rows = 4 }: LoadingStateProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Загрузка"
      className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-7 transition-opacity duration-300 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* дышащая точка-индикатор — единственный явный "признак жизни" */}
      <div className="mb-5 flex items-center gap-2">
        <span className="pulse-dot h-[10px] w-[10px] shrink-0 rounded-full bg-phase" />
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
          загрузка
        </span>
      </div>

      {(variant === "dashboard" || variant === "detail") && (
        <div className="mb-5 flex flex-col items-center">
          <div className="pulse-surface h-[200px] w-[200px] rounded-full border border-line bg-surface-2" />
          <div className="pulse-surface mt-5 h-[14px] w-[140px] rounded-[3px] bg-surface-3" />
          <div className="pulse-surface mt-2.5 h-[10px] w-[100px] rounded-[3px] bg-surface-2" />
        </div>
      )}

      {variant === "form" && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="pulse-surface h-[52px] w-full rounded-card border border-line bg-surface" />
          <div className="pulse-surface h-[44px] w-2/3 self-end rounded-card bg-surface-3" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {Array.from({ length: variant === "form" ? 2 : rows }).map((_, i) => (
          <div
            key={i}
            className="pulse-surface rounded-card border border-line bg-surface p-4"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="h-[13px] w-[38%] rounded-[3px] bg-surface-3" />
              <div className="h-[13px] w-[16%] rounded-[3px] bg-surface-2" />
            </div>
            <div className="mt-3 h-[10px] w-[70%] rounded-[3px] bg-surface-2" />
          </div>
        ))}
      </div>

      <style jsx>{`
        .pulse-dot {
          animation: verta-breathe 1.8s ease-in-out infinite;
        }
        .pulse-surface {
          animation: verta-breathe 1.8s ease-in-out infinite;
          animation-fill-mode: both;
        }
        @keyframes verta-breathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-dot, .pulse-surface {
            animation: none;
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
