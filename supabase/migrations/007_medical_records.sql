create table if not exists medical_record (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'other',
  file_path   text,
  file_name   text,
  file_type   text,
  file_size   int,
  note        text,
  record_date date,
  created_at  timestamptz default now()
);
alter table medical_record enable row level security;
