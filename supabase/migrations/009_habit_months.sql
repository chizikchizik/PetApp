-- Привязка привычек к месяцам: начало и конец периода отслеживания
ALTER TABLE habit ADD COLUMN IF NOT EXISTS started_month text; -- YYYY-MM, null = с начала времён
ALTER TABLE habit ADD COLUMN IF NOT EXISTS ended_month   text; -- YYYY-MM, null = продолжается, значение = последний месяц включительно
