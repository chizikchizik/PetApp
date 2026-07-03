"use client";

import { useState } from "react";
import type { Med } from "@/lib/data";

const LOCATIONS = ["Живот", "Спина", "Зуб", "Другое"];

export function PainQuickLogSheet({
  asNeededMeds,
  onSave,
  onClose,
}: {
  asNeededMeds: Med[];
  onSave: (painLocation: string, medId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [location, setLocation] = useState<string | null>(null);
  const [medId, setMedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!location) return;
    setSaving(true);
    await onSave(location, medId);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[430px] rounded-card border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">Что болит?</p>
          <button type="button" onClick={onClose} className="font-mono text-[18px] leading-none text-ink-3">×</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocation(loc)}
              className={`rounded-[3px] border py-3 font-sans text-[13px] transition active:scale-95 ${
                location === loc ? "border-phase bg-phase-soft text-phase-deep" : "border-line text-ink-2"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {asNeededMeds.length > 0 && (
          <>
            <p className="mb-2 mt-5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">Чем сняла?</p>
            <div className="flex flex-wrap gap-2">
              {asNeededMeds.map((med) => (
                <button
                  key={med.id}
                  type="button"
                  onClick={() => setMedId(medId === med.id ? null : med.id)}
                  className={`rounded-[2px] border px-[13px] py-[9px] font-sans text-[13px] transition active:scale-95 ${
                    medId === med.id ? "border-phase bg-phase-soft text-phase-deep" : "border-line text-ink-2"
                  }`}
                >
                  {med.name}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!location || saving}
          className="mt-5 w-full rounded-card border border-phase bg-phase-soft py-3.5 font-sans text-[14px] font-semibold text-phase-deep transition active:scale-[0.99] disabled:opacity-40"
        >
          {saving ? "Сохраняю…" : "Готово ✓"}
        </button>
      </div>
    </div>
  );
}
