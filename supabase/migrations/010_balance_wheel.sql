-- Колесо баланса: оценки по 6 сферам жизни
create table if not exists balance_assessment (
  id          uuid default gen_random_uuid() primary key,
  assessed_at date not null default current_date,
  rest        int check (rest between 1 and 10),
  intellectual int check (intellectual between 1 and 10),
  nutrition   int check (nutrition between 1 and 10),
  fitness     int check (fitness between 1 and 10),
  social      int check (social between 1 and 10),
  sleep       int check (sleep between 1 and 10),
  note        text,
  created_at  timestamptz default now()
);

alter table balance_assessment enable row level security;
create policy "service role all" on balance_assessment using (true) with check (true);
