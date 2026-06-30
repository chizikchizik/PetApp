-- petapp · схема БД + сид реальных данных.
-- Как применить: Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run.
-- Доступ только с сервера (service_role); RLS включён без публичных политик = приватно.

-- ─────────────────────────── СХЕМА ───────────────────────────

create table if not exists cycle_start (
  id          uuid primary key default gen_random_uuid(),
  start_date  date not null unique,
  created_at  timestamptz default now()
);

create table if not exists daily_log (
  id                  uuid primary key default gen_random_uuid(),
  log_date            date not null unique,
  mood                int,
  energy              int,
  symptoms            text[] default '{}',
  migraine            boolean default false,
  migraine_intensity  int,
  migraine_aura       boolean default false,
  migraine_triggers   text[] default '{}',
  weight_kg           numeric(5,2),
  meds_taken          text[] default '{}',
  habits_done         text[] default '{}',
  note                text,
  updated_at          timestamptz default now()
);

create table if not exists weight_entry (
  entry_date  date primary key,
  plan_kg     numeric(5,2),
  actual_kg   numeric(5,2),
  deficit     int
);

create table if not exists migraine_event (
  id          uuid primary key default gen_random_uuid(),
  event_date  date not null,
  aura        boolean default false,
  triptan     boolean default false,
  meds        text,
  intensity   int
);

create table if not exists medication (
  id          text primary key,
  name        text not null,
  note        text,
  when_label  text,
  time_label  text,
  sort        int default 0
);

create table if not exists habit (
  id    serial primary key,
  name  text not null unique,
  sort  int default 0
);

alter table cycle_start     enable row level security;
alter table daily_log       enable row level security;
alter table weight_entry    enable row level security;
alter table migraine_event  enable row level security;
alter table medication      enable row level security;
alter table habit           enable row level security;

-- ─────────────────────────── СИД ───────────────────────────

insert into cycle_start (start_date) values
  ('2025-01-20'),('2025-02-21'),('2025-03-20'),('2025-04-18'),('2025-05-16'),
  ('2025-06-13'),('2025-07-09'),('2025-08-08'),('2025-09-13'),('2025-10-10'),
  ('2025-11-10'),('2025-12-10'),('2026-01-07'),('2026-02-03'),('2026-03-01'),
  ('2026-03-28'),('2026-04-28'),('2026-05-23'),('2026-06-19')
on conflict (start_date) do nothing;

insert into medication (id, name, note, when_label, time_label, sort) values
  ('amitriptyline','Амитриптилин','профилактика мигрени (невролог)','вечер','21:00',1),
  ('vitamins','Витамины','гинеколог','утро','09:00',2)
on conflict (id) do nothing;

insert into habit (name, sort) values
  ('Сон до 00:00',1),('Амитриптилин',2),('Витамины',3),('Дефицит ккал',4),
  ('Шаги 12500',5),('Вода 1500+',6),('Без сахара',7),('Без алкоголя',8),('Растяжка',9)
on conflict (name) do nothing;

insert into weight_entry (entry_date, plan_kg, actual_kg) values
  ('2026-05-15', null, 74.2),
  ('2026-05-20', null, 70.8),
  ('2026-05-25', 70,   69.9),
  ('2026-05-31', null, 68.85),
  ('2026-06-01', 69,   null),
  ('2026-06-03', null, 68.7),
  ('2026-06-08', 68,   null),
  ('2026-06-09', null, 67.7),
  ('2026-06-12', null, 67.4),
  ('2026-06-15', 67,   67.7),
  ('2026-06-17', null, 67.2),
  ('2026-06-20', null, 67.5),
  ('2026-06-21', null, 66.9),
  ('2026-06-22', 66,   null),
  ('2026-06-23', null, 67.3),
  ('2026-06-25', null, 66.75),
  ('2026-06-29', 65,   null),
  ('2026-07-13', 63,   null),
  ('2026-08-03', 60,   null),
  ('2026-09-13', 54,   null)
on conflict (entry_date) do nothing;

insert into migraine_event (event_date, aura, triptan, meds) values
  ('2026-04-02', true, true, 'суматриптан 100'),
  ('2026-04-07', true, true, 'суматриптан 100'),
  ('2026-04-09', true, true, 'суматриптан 100'),
  ('2026-04-10', true, true, 'суматриптан 100'),
  ('2026-04-23', true, true, 'суматриптан 100'),
  ('2026-04-26', true, true, 'суматриптан 100'),
  ('2026-04-30', true, true, 'суматриптан 100'),
  ('2026-05-08', true, true, 'суматриптан 100'),
  ('2026-05-12', true, true, 'суматриптан 100'),
  ('2026-05-16', true, true, 'суматриптан 100'),
  ('2026-05-17', true, true, 'суматриптан 100'),
  ('2026-05-26', true, true, 'суматриптан 100'),
  ('2026-05-29', true, true, 'суматриптан 100'),
  ('2026-06-03', true, true, 'суматриптан 100'),
  ('2026-06-08', true, true, 'суматриптан 100'),
  ('2026-06-10', true, true, 'суматриптан 100'),
  ('2026-06-17', true, true, 'суматриптан 100'),
  ('2026-06-24', true, true, 'суматриптан 100');
