"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ background: "#16150F", color: "#FBFAF7" }}
      className="rounded-[3px] px-3.5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase"
    >
      Распечатать / Сохранить PDF
    </button>
  );
}
