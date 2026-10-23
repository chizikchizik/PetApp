// Какие разделы пользовательница отслеживает (миграция 060). Выключенный
// раздел скрыт из меню, с «Сегодня» и из чек-ина; данные не удаляются.
// Без server-only — тип и дефолт нужны и клиентским компонентам.
export type TrackedModules = { migraine: boolean; training: boolean; weight: boolean };

export const ALL_TRACKED: TrackedModules = { migraine: true, training: true, weight: true };

export const MODULE_LABELS: Record<keyof TrackedModules, { title: string; hint: string }> = {
  migraine: { title: "Мигрень", hint: "приступы, препараты, отчёт для невролога" },
  training: { title: "Тренировки", hint: "журнал, расписание, годовая карта" },
  weight: { title: "Вес и калории", hint: "вес, план похудения, баланс ккал" },
};
