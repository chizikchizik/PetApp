create table if not exists app_user (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  display_name  text not null default 'Пользователь',
  password_hash text not null,
  password_salt text not null,
  invite_used   boolean default false,
  created_at    timestamptz default now()
);
-- No RLS — only accessed via service_role

-- Add user_id to data tables (nullable for backwards compat with existing data)
alter table daily_log       add column if not exists app_user_id uuid references app_user(id);
alter table cycle_start     add column if not exists app_user_id uuid references app_user(id);
alter table weight_entry    add column if not exists app_user_id uuid references app_user(id);
alter table migraine_event  add column if not exists app_user_id uuid references app_user(id);
alter table workout_log     add column if not exists app_user_id uuid references app_user(id);
