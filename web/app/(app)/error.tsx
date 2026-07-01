"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 px-6">
      <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-warn">Ошибка сервера</p>
      <pre className="w-full overflow-auto rounded border border-line bg-surface-2 p-3 font-mono text-[11px] text-ink-2 whitespace-pre-wrap">
        {error.message || "Unknown error"}
        {"\n"}
        {error.digest ? `digest: ${error.digest}` : ""}
      </pre>
      <button
        onClick={reset}
        className="rounded border border-line px-4 py-2 font-mono text-[12px] text-ink-3"
      >
        Перезагрузить
      </button>
    </div>
  );
}
