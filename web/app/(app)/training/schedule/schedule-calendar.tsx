"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEventRow,
  type CalendarEventInput,
} from "./actions";

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  workout:  "Тренировка",
  event:    "Событие",
  reminder: "Напоминание",
};

const TYPE_COLORS: Record<string, string> = {
  workout:  "var(--phase)",
  event:    "var(--ink-2)",
  reminder: "var(--warn, #e8a23a)",
};

const TYPE_BG: Record<string, string> = {
  workout:  "var(--phase-soft)",
  event:    "var(--surface-3)",
  reminder: "rgba(232,162,58,0.12)",
};

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAYS_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DAYS_FULL  = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoMonday(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return fmtLocal(d);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return fmtLocal(d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ── Event pill ─────────────────────────────────────────────────────────────

function EventPill({
  ev,
  onTap,
}: {
  ev: CalendarEventRow;
  onTap: (ev: CalendarEventRow) => void;
}) {
  const done    = ev.status === "done";
  const skipped = ev.status === "skipped";
  const color   = TYPE_COLORS[ev.type] ?? "var(--ink-2)";
  const bg      = TYPE_BG[ev.type] ?? "var(--surface-3)";

  return (
    <button
      type="button"
      onClick={() => onTap(ev)}
      className="w-full rounded-[3px] px-1.5 py-1 text-left transition active:opacity-70"
      style={{ background: done || skipped ? "var(--surface-2)" : bg }}
    >
      <span className="flex items-center gap-1.5">
        <span
          className="mt-[1px] h-2 w-2 shrink-0 rounded-full"
          style={{ background: done ? "var(--ink-4)" : skipped ? "var(--ink-4)" : color }}
        />
        <span
          className={`flex-1 truncate font-sans text-[12px] leading-snug ${
            skipped ? "text-ink-4 line-through" : done ? "text-ink-3" : "text-ink"
          }`}
        >
          {ev.title}
        </span>
        {done && (
          <span className="shrink-0 font-mono text-[10px] text-ink-4">✓</span>
        )}
      </span>
      {/* Время — отдельной строкой: в месячной сетке ячейка ~48px, на одной
          строке с названием оно не помещается и обрезалось на мобильной вёрстке */}
      {ev.time_start && !skipped && !done && (
        <span className="block pl-3.5 font-mono text-[10px] leading-tight text-ink-3">{ev.time_start}</span>
      )}
    </button>
  );
}

// ── Week row ────────────────────────────────────────────────────────────────

function WeekRow({
  dates,
  todayISO,
  month,
  eventsByDate,
  onDayTap,
  onEventTap,
}: {
  dates: string[];
  todayISO: string;
  month: number;
  eventsByDate: Map<string, CalendarEventRow[]>;
  onDayTap: (iso: string) => void;
  onEventTap: (ev: CalendarEventRow) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-px border-b border-line">
      {dates.map((iso) => {
        const dayNum = parseInt(iso.slice(8));
        const thisMonth = parseInt(iso.slice(5, 7)) - 1 === month;
        const isToday = iso === todayISO;
        const events = eventsByDate.get(iso) ?? [];

        return (
          <div
            key={iso}
            className={`min-h-[64px] p-1 ${thisMonth ? "bg-surface" : "bg-surface-2"}`}
          >
            <button
              type="button"
              onClick={() => onDayTap(iso)}
              className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] transition ${
                isToday
                  ? "bg-phase text-on-phase font-semibold"
                  : thisMonth
                  ? "text-ink hover:bg-surface-3"
                  : "text-ink-4"
              }`}
            >
              {dayNum}
            </button>
            <div className="space-y-0.5">
              {events.slice(0, 3).map((ev) => (
                <EventPill key={ev.id} ev={ev} onTap={onEventTap} />
              ))}
              {events.length > 3 && (
                <span className="block pl-1 font-mono text-[10px] text-ink-3">
                  +{events.length - 3}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Add / Edit modal ────────────────────────────────────────────────────────

type ModalMode = "add" | "edit";

function EventModal({
  mode,
  initial,
  defaultDate,
  onClose,
  onSaved,
}: {
  mode: ModalMode;
  initial?: CalendarEventRow;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [, startT] = useTransition();

  const [form, setForm] = useState({
    title:       initial?.title ?? "",
    type:        (initial?.type ?? "workout") as "workout" | "event" | "reminder",
    event_date:  initial?.event_date ?? defaultDate,
    time_start:  initial?.time_start ?? "",
    duration_min: initial?.duration_min != null ? String(initial.duration_min) : "",
    note:        initial?.note ?? "",
    status:      (initial?.status ?? "planned") as "planned" | "done" | "skipped",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    startT(async () => {
      if (mode === "add") {
        await createCalendarEvent({
          event_date:  form.event_date,
          title:       form.title,
          type:        form.type,
          time_start:  form.time_start || undefined,
          duration_min: form.duration_min ? parseInt(form.duration_min) : null,
          note:        form.note || undefined,
        });
      } else if (initial) {
        await updateCalendarEvent(initial.id, {
          title:       form.title,
          type:        form.type,
          event_date:  form.event_date,
          time_start:  form.time_start || null,
          duration_min: form.duration_min ? parseInt(form.duration_min) : null,
          note:        form.note || null,
          status:      form.status,
        });
      }
      router.refresh();
      onSaved();
    });
  }

  function doDelete() {
    if (!initial) return;
    setDeleting(true);
    startT(async () => {
      await deleteCalendarEvent(initial.id);
      router.refresh();
      onSaved();
    });
  }

  function quickStatus(s: "done" | "skipped") {
    if (!initial) return;
    startT(async () => {
      await updateCalendarEvent(initial.id, {
        status: initial.status === s ? "planned" : s,
      });
      router.refresh();
      onSaved();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[430px] rounded-card border border-line bg-surface p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            {mode === "add" ? "Новое событие" : "Изменить"}
          </p>
          <button onClick={onClose} className="font-mono text-[18px] leading-none text-ink-3">×</button>
        </div>

        {/* Quick status buttons for editing */}
        {mode === "edit" && initial && (
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => quickStatus("done")}
              className={`flex-1 rounded-[3px] border py-2 font-mono text-[11px] tracking-[0.08em] uppercase transition ${
                initial.status === "done"
                  ? "border-phase bg-phase-soft text-phase-deep"
                  : "border-line text-ink-3"
              }`}
            >
              ✓ Сделано
            </button>
            <button
              type="button"
              onClick={() => quickStatus("skipped")}
              className={`flex-1 rounded-[3px] border py-2 font-mono text-[11px] tracking-[0.08em] uppercase transition ${
                initial.status === "skipped"
                  ? "border-warn bg-surface-3 text-ink-2"
                  : "border-line text-ink-3"
              }`}
            >
              — Вычеркнуть
            </button>
          </div>
        )}

        <div className="space-y-3">
          {/* Title */}
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Название…"
            autoFocus
            className="w-full rounded-[3px] border border-line bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
          />

          {/* Type */}
          <div className="flex gap-1.5">
            {(["workout", "event", "reminder"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 rounded-[3px] border py-2 font-mono text-[10px] tracking-[0.06em] uppercase transition ${
                  form.type === t
                    ? "border-phase bg-phase-soft text-phase-deep font-semibold"
                    : "border-line text-ink-3"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 font-mono text-[10px] text-ink-3">Дата</p>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full rounded-[3px] border border-line bg-surface px-2 py-2 text-[13px] text-ink outline-none focus:border-phase"
              />
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] text-ink-3">Время (необяз.)</p>
              <input
                type="time"
                value={form.time_start}
                onChange={(e) => setForm({ ...form, time_start: e.target.value })}
                className="w-full rounded-[3px] border border-line bg-surface px-2 py-2 text-[13px] text-ink outline-none focus:border-phase"
              />
            </div>
          </div>

          {/* Duration (workout only) */}
          {form.type === "workout" && (
            <div>
              <p className="mb-1 font-mono text-[10px] text-ink-3">Длительность, мин</p>
              <input
                type="number"
                inputMode="numeric"
                value={form.duration_min}
                onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                placeholder="60"
                className="w-full rounded-[3px] border border-line bg-surface px-3.5 py-2 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
              />
            </div>
          )}

          {/* Note */}
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Заметка…"
            rows={2}
            className="w-full resize-none rounded-[3px] border border-line bg-surface px-3.5 py-2 text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
          />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {mode === "edit" && (
              <button
                type="button"
                onClick={() => confirmDelete ? doDelete() : setConfirmDelete(true)}
                disabled={deleting}
                className={`rounded-[3px] border px-3 py-2.5 font-mono text-[11px] transition ${
                  confirmDelete ? "border-red-600 bg-red-600 text-white" : "border-line text-ink-3"
                }`}
              >
                {confirmDelete ? "Точно?" : "Удалить"}
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!form.title.trim() || saving}
              className="flex-1 rounded-[3px] bg-phase py-2.5 font-semibold text-[14px] text-on-phase transition active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? "…" : mode === "add" ? "Добавить" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Day detail sheet (list of events for a day) ────────────────────────────

function DaySheet({
  iso,
  events,
  onClose,
  onAdd,
  onEditEvent,
}: {
  iso: string;
  events: CalendarEventRow[];
  onClose: () => void;
  onAdd: () => void;
  onEditEvent: (ev: CalendarEventRow) => void;
}) {
  const d = new Date(iso + "T12:00:00");
  const dowIdx = (d.getDay() + 6) % 7;
  const label = `${DAYS_FULL[dowIdx]}, ${d.getDate()} ${["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"][d.getMonth()]}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[430px] rounded-card border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-sans text-[15px] font-semibold text-ink">{label}</p>
          <button onClick={onClose} className="font-mono text-[18px] leading-none text-ink-3">×</button>
        </div>

        {events.length === 0 ? (
          <p className="py-2 font-mono text-[12px] text-ink-3">Событий нет</p>
        ) : (
          <div className="mb-3 space-y-1.5">
            {events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => { onClose(); onEditEvent(ev); }}
                className="flex w-full items-center gap-3 rounded-[3px] border border-line bg-surface-2 px-3 py-2.5 text-left transition active:opacity-70"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: TYPE_COLORS[ev.type] ?? "var(--ink-3)" }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`font-sans text-[13px] leading-snug ${ev.status === "skipped" ? "line-through text-ink-3" : ev.status === "done" ? "text-ink-3" : "text-ink"}`}>
                    {ev.title}
                    {ev.status === "done" && <span className="ml-1.5 text-ink-4">✓</span>}
                  </p>
                  {(ev.time_start || ev.duration_min) && (
                    <p className="font-mono text-[10px] text-ink-3">
                      {[ev.time_start, ev.duration_min ? `${ev.duration_min} мин` : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="font-mono text-[10px] text-ink-4">{TYPE_LABELS[ev.type]}</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-dashed border-line py-3 font-mono text-[11px] tracking-[0.08em] uppercase text-ink-3 transition active:opacity-70"
        >
          + Добавить событие
        </button>
      </div>
    </div>
  );
}

// ── Main calendar ──────────────────────────────────────────────────────────

export function ScheduleCalendar({
  initialEvents,
  initialYear,
  initialMonth,
}: {
  initialEvents: CalendarEventRow[];
  initialYear: number;
  initialMonth: number;
}) {
  const router = useRouter();
  const todayISO = fmtLocal(new Date());

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-based
  const [events, setEvents] = useState<CalendarEventRow[]>(initialEvents);

  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [addModal, setAddModal] = useState<string | null>(null); // ISO date
  const [editModal, setEditModal] = useState<CalendarEventRow | null>(null);

  // Navigate months
  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid (5 or 6 weeks)
  const firstMonday = isoMonday(year, month);
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const numWeeks = firstDayOfWeek + daysInMonth(year, month) > 35 ? 6 : 5;
  const weeks: string[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(addDays(firstMonday, w * 7 + d));
    }
    weeks.push(week);
  }
  const lastWeek = weeks[numWeeks - 1];
  const lastDayISO = lastWeek[6];
  const firstISO   = firstMonday;
  const lastISO    = lastDayISO;

  // Build event map
  const eventsByDate = new Map<string, CalendarEventRow[]>();
  for (const ev of events) {
    const list = eventsByDate.get(ev.event_date) ?? [];
    list.push(ev);
    eventsByDate.set(ev.event_date, list);
  }

  async function refreshEvents() {
    const res = await fetch(`/api/calendar-events?from=${firstISO}&to=${lastISO}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data);
    }
    router.refresh();
  }

  // Re-fetch whenever the visible month changes — prev/nextMonth only moved
  // year/month state, `events` stayed pinned to whatever range was fetched on
  // page load, so paging away and back could look like everything vanished.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/calendar-events?from=${firstISO}&to=${lastISO}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data && !cancelled) setEvents(data); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  function onDayTap(iso: string) {
    const dayEvents = eventsByDate.get(iso) ?? [];
    setDaySheet(iso);
    // If tapping empty future day → go straight to add
    if (dayEvents.length === 0 && iso >= todayISO) {
      setDaySheet(null);
      setAddModal(iso);
    }
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-line font-mono text-[13px] text-ink-2 transition active:bg-surface-3"
        >
          ←
        </button>
        <span className="font-sans text-[15px] font-semibold text-ink">
          {MONTHS_RU[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-line font-mono text-[13px] text-ink-2 transition active:bg-surface-3"
        >
          →
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-px border-b border-line mb-px">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="py-1 text-center font-mono text-[9px] uppercase text-ink-3">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="rounded-[6px] border border-line overflow-hidden">
        {weeks.map((week, wi) => (
          <WeekRow
            key={wi}
            dates={week}
            todayISO={todayISO}
            month={month}
            eventsByDate={eventsByDate}
            onDayTap={onDayTap}
            onEventTap={(ev) => setEditModal(ev)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {(["workout", "event", "reminder"] as const).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
            <span className="font-mono text-[10px] text-ink-3">{TYPE_LABELS[t].toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Add event button */}
      <button
        type="button"
        onClick={() => setAddModal(todayISO)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line py-3.5 font-mono text-[11px] tracking-[0.08em] uppercase text-ink-3 transition active:opacity-70"
      >
        + добавить событие
      </button>

      {/* Modals */}
      {daySheet && (
        <DaySheet
          iso={daySheet}
          events={eventsByDate.get(daySheet) ?? []}
          onClose={() => setDaySheet(null)}
          onAdd={() => { setDaySheet(null); setAddModal(daySheet); }}
          onEditEvent={(ev) => setEditModal(ev)}
        />
      )}

      {addModal && (
        <EventModal
          mode="add"
          defaultDate={addModal}
          onClose={() => setAddModal(null)}
          onSaved={() => { setAddModal(null); refreshEvents(); }}
        />
      )}

      {editModal && (
        <EventModal
          mode="edit"
          initial={editModal}
          defaultDate={editModal.event_date}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); refreshEvents(); }}
        />
      )}
    </div>
  );
}
