// Плоские константы без серверных зависимостей — безопасно импортировать
// и из клиентских, и из серверных компонентов (в отличие от lib/habits.ts,
// который помечен "server-only").

// Habit-checklist entries that actually represent sport, not a generic habit —
// written by TrainingQuickAdd/saveWorkout as a side effect of logging a
// workout (see training/actions.ts). Shared so /habits and check-in agree on
// what counts as "sport" vs a plain habit when splitting the matrix.
export const SPORT_HABIT_NAMES = new Set<string>(["Спорт", "Бег"]);
