// Canonical list of known MigreBot free-text medication mentions → display
// name. Single source of truth shared between med-calendar.tsx's detection/
// labeling (client) and the MigreBot import's auto-registration (server) —
// previously these lived as two separate, near-identical arrays that could
// silently drift apart (which is exactly how "Спрей"/"Делмигрен" and 6
// others ended up with a detection pattern but no real medication row).
export type MedDetectionPattern = { pattern: RegExp; label: string };

export const MIGREBOT_MED_PATTERNS: MedDetectionPattern[] = [
  { pattern: /суматриптан|имигран/i,    label: "Суматриптан" },
  { pattern: /нурофен|ибупрофен/i,      label: "Нурофен" },
  { pattern: /спрей|назальн|эксенза/i,  label: "Эксенза" },
  { pattern: /спазмалгон/i,             label: "Спазмалгон" },
  { pattern: /пенталгин/i,              label: "Пенталгин" },
  { pattern: /триптаджик/i,             label: "Триптаджик" },
  { pattern: /делмигрен/i,              label: "Делмигрен" },
  { pattern: /капориза/i,               label: "Капориза" },
  { pattern: /релпакс|элетриптан/i,     label: "Релпакс" },
  { pattern: /аскофен|аскопар/i,        label: "Аскофен" },
  { pattern: /золмитриптан|зомиг/i,     label: "Зомиг" },
  { pattern: /ризатриптан|максальт/i,   label: "Максальт" },
  { pattern: /парацетамол|панадол/i,    label: "Панадол" },
  { pattern: /кеторолак|кетанов/i,      label: "Кетанов" },
];

export function detectMedLabels(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, label } of MIGREBOT_MED_PATTERNS) {
    if (pattern.test(text) && !found.includes(label)) found.push(label);
  }
  return found;
}
