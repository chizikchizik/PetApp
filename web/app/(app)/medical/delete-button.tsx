"use client";

import { useState } from "react";
import { deleteRecord } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (confirm) {
    return (
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            setDeleting(true);
            await deleteRecord(id);
          }}
          disabled={deleting}
          className="font-mono text-[10px] uppercase text-red-500 disabled:opacity-50"
        >
          {deleting ? "удаляю…" : "удалить?"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="font-mono text-[10px] text-ink-3"
        >
          отмена
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="font-mono text-[10px] text-ink-4 transition hover:text-ink-3"
    >
      удалить
    </button>
  );
}
