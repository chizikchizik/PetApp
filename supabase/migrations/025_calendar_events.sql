-- 025: Calendar events — one-time events on specific dates
-- (training, appointments, reminders) with done/skipped tracking

CREATE TABLE IF NOT EXISTS calendar_event (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id  uuid REFERENCES app_user(id),
  event_date   date NOT NULL,
  title        text NOT NULL,
  type         text NOT NULL DEFAULT 'event', -- 'workout' | 'event' | 'reminder'
  time_start   text,           -- "19:00"
  duration_min int,
  note         text,
  status       text NOT NULL DEFAULT 'planned', -- 'planned' | 'done' | 'skipped'
  moved_to     date,           -- date this was rescheduled TO
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_calendar_event_date
  ON calendar_event(app_user_id, event_date);
