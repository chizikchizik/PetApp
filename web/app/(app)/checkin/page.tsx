import { redirect } from "next/navigation";

// Чек-ин объединён с экраном «Сегодня» (/dashboard). Старые ссылки и
// закладки ведут туда же, с сохранением выбранной даты.
export default async function CheckIn({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  redirect(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/dashboard?date=${date}` : "/dashboard");
}
