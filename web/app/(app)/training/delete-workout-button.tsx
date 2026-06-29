"use client";
import { useState, useTransition } from "react";
import { deleteWorkout } from "./actions";

export function DeleteWorkoutButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-4 transition hover:text-warn"
      >
        удалить
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await deleteWorkout(id);
          })
        }
        disabled={pending}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-warn disabled:opacity-50"
      >
        {pending ? "…" : "да, удалить"}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-3"
      >
        отмена
      </button>
    </div>
  );
}
