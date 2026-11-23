"use client";
import { useRouter } from "next/navigation";

/** Goes to wherever the user actually came from (browser history) instead of
 *  a hardcoded parent route — falls back to `href` if there's no history
 *  (e.g. deep link / opened in a new tab). */
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(href);
      }}
      className="-my-2 flex min-h-[44px] items-center font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3"
    >
      {label}
    </button>
  );
}
