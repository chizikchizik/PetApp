-- Запусти в Supabase → SQL Editor перед использованием экрана тренировок
create table if not exists workout_log (
  id           uuid primary key default gen_random_uuid(),
  workout_date date not null,
  type         text not null,
  duration_min int,
  feeling      int check (feeling between 1 and 5),
  note         text,
  created_at   timestamptz default now()
);
alter table workout_log enable row level security;
