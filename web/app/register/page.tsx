import { register } from "./actions";

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  const inviteCodeRequired = Boolean(process.env.PETAPP_INVITE_CODE);
  return (
    <main className="phase-follicular mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center px-6">
      <p className="font-serif font-bold text-[22px] tracking-[0.04em] text-ink">VERTA</p>
      <h1 className="mt-2 font-serif text-[26px] font-bold uppercase">Регистрация</h1>
      <p className="mt-1 text-[13px] text-ink-2">Создай свой личный дневник</p>

      <form action={register} className="mt-7 space-y-3">
        <input
          name="displayName"
          type="text"
          placeholder="Твоё имя"
          required
          className="w-full rounded-[3px] border border-line bg-surface px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full rounded-[3px] border border-line bg-surface px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
        <input
          name="password"
          type="password"
          placeholder="Пароль (мин. 8 символов)"
          required
          className="w-full rounded-[3px] border border-line bg-surface px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
        {inviteCodeRequired ? (
          <input
            name="inviteCode"
            type="text"
            placeholder="Код приглашения"
            required
            className="w-full rounded-[3px] border border-line bg-surface px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
          />
        ) : null}
        {e === "1" ? <p className="text-[13px] font-medium text-warn">Неверный код приглашения</p> : null}
        {e === "2" ? <p className="text-[13px] font-medium text-warn">Email уже зарегистрирован</p> : null}
        {e === "3" ? <p className="text-[13px] font-medium text-warn">Пароль слишком короткий</p> : null}
        <button
          type="submit"
          className="w-full rounded-[3px] bg-phase py-4 text-[15px] font-semibold text-on-phase transition active:scale-[0.99]"
        >
          Создать аккаунт
        </button>
        <p className="text-center font-mono text-[10px] tracking-[0.08em] text-ink-3">
          Уже есть аккаунт?{" "}
          <a href="/login" className="text-phase underline underline-offset-2">Войти</a>
        </p>
      </form>
    </main>
  );
}
