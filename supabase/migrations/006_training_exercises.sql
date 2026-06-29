-- Упражнения внутри тренировки
create table if not exists workout_exercise (
  id              uuid primary key default gen_random_uuid(),
  workout_id      uuid references workout_log(id) on delete cascade,
  exercise_name   text not null,
  exercise_slug   text,
  order_index     int default 0,
  target_sets     int,
  target_reps     text,
  target_weight   numeric(6,2),
  actual_sets     int,
  actual_reps     text,
  actual_weight   numeric(6,2),
  rpe             int,
  note            text
);
alter table workout_exercise enable row level security;

-- Шаблоны тренировок
create table if not exists workout_template (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null,
  cycle_phase   text,
  duration_min  int,
  exercises     jsonb not null default '[]',
  is_active     boolean default true,
  created_at    timestamptz default now()
);
alter table workout_template enable row level security;

-- Расписание на неделю
create table if not exists weekly_schedule (
  id              uuid primary key default gen_random_uuid(),
  day_of_week     int not null check (day_of_week between 1 and 7),
  workout_type    text,
  workout_label   text,
  template_id     uuid references workout_template(id),
  is_rest         boolean default false,
  time_start      text,
  duration_min    int,
  is_active       boolean default true,
  note            text
);
alter table weekly_schedule enable row level security;

-- Seed templates
insert into workout_template (name, type, cycle_phase, duration_min, exercises) values
('Силовая А — Фолликулярная', 'strength', 'follicular', 55, '[
  {"order_index":0,"exercise_name":"Динамическая разминка","exercise_slug":"warmup_dynamic","target_sets":1,"target_reps":"8 мин"},
  {"order_index":1,"exercise_name":"Присед со штангой","exercise_slug":"squat_barbell","target_sets":4,"target_reps":"8","target_weight":40},
  {"order_index":2,"exercise_name":"Румынская тяга","exercise_slug":"romanian_deadlift","target_sets":4,"target_reps":"10","target_weight":35},
  {"order_index":3,"exercise_name":"Жим гантелей лёжа","exercise_slug":"dumbbell_bench_press","target_sets":3,"target_reps":"10","target_weight":14},
  {"order_index":4,"exercise_name":"Тяга верхнего блока","exercise_slug":"lat_pulldown","target_sets":3,"target_reps":"10","target_weight":35},
  {"order_index":5,"exercise_name":"Выпады с гантелями","exercise_slug":"dumbbell_lunges","target_sets":3,"target_reps":"10 каждой","target_weight":10},
  {"order_index":6,"exercise_name":"Планка на предплечьях","exercise_slug":"plank_forearm","target_sets":3,"target_reps":"40s"},
  {"order_index":7,"exercise_name":"Растяжка + МФР","exercise_slug":"cooldown_stretch","target_sets":1,"target_reps":"7 мин"}
]'::jsonb),
('Функциональная — группа', 'functional', null, 50, '[
  {"order_index":0,"exercise_name":"Разминка","exercise_slug":"warmup_functional","target_sets":1,"target_reps":"7 мин"},
  {"order_index":1,"exercise_name":"Становая тяга с гирей","exercise_slug":"trap_bar_deadlift","target_sets":4,"target_reps":"12"},
  {"order_index":2,"exercise_name":"Подъём ног в висе","exercise_slug":"leg_raises","target_sets":3,"target_reps":"15"},
  {"order_index":3,"exercise_name":"Кетлбелл-свинг","exercise_slug":"kettlebell_swing","target_sets":3,"target_reps":"15","target_weight":12},
  {"order_index":4,"exercise_name":"Отжимания","exercise_slug":"pushup","target_sets":3,"target_reps":"12"},
  {"order_index":5,"exercise_name":"Приседания с прыжком","exercise_slug":"jump_squat","target_sets":3,"target_reps":"10"},
  {"order_index":6,"exercise_name":"Тяга гири в наклоне","exercise_slug":"kettlebell_row","target_sets":3,"target_reps":"12 каждой","target_weight":12},
  {"order_index":7,"exercise_name":"Растяжка","exercise_slug":"cooldown_breathing","target_sets":1,"target_reps":"7 мин"}
]'::jsonb)
on conflict do nothing;

-- Seed schedule
insert into weekly_schedule (day_of_week, workout_type, workout_label, is_rest, time_start, duration_min) values
(1, 'strength', 'Силовая А', false, '19:00', 55),
(2, 'volleyball', 'Волейбол', false, '19:00', 90),
(3, 'functional', 'Функциональная', false, '19:00', 50),
(4, 'volleyball', 'Волейбол', false, '19:00', 90),
(5, 'strength', 'Силовая Б', false, '19:00', 55),
(6, 'run', 'Бег / МФР', false, null, 40),
(7, 'rest', 'Выходной', true, null, null)
on conflict do nothing;
