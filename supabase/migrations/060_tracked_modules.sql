-- 060: какие разделы пользовательница отслеживает — мигрень, тренировки, вес.
-- Выключенный раздел пропадает из нижнего меню, с экрана «Сегодня» и из
-- чек-ина. Данные раздела не удаляются и вернутся при повторном включении.
-- По умолчанию всё включено: у существующих аккаунтов ничего не меняется.
alter table app_user
  add column if not exists track_migraine boolean not null default true,
  add column if not exists track_training boolean not null default true,
  add column if not exists track_weight   boolean not null default true;
