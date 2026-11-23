"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions/locale";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * Previously this was `useState("EN")` and nothing else: the control
 * defaulted to English, the site was Indonesian, and clicking either side
 * changed which label was bold. A switch that moves but changes nothing is
 * not a smaller feature than a working one — it is a false statement about
 * the product, made at the top of every page.
 *
 * Now it writes the choice to a cookie and refreshes, so the server
 * re-renders in the chosen language. router.refresh() keeps scroll position
 * and form state, which a full reload would throw away.
 */
export function LanguageToggle() {
  const active = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === active) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-center bg-[#f6f3f2] px-3 py-1 rounded-full text-xs font-medium select-none transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {LOCALES.map((loc, i) => (
        <span key={loc} className="contents">
          {i > 0 && <span className="mx-2 text-[#bec9c2]">|</span>}
          <button
            type="button"
            lang={loc}
            aria-pressed={active === loc}
            disabled={isPending}
            onClick={() => choose(loc)}
            className={
              active === loc
                ? "text-[#1a7a5e] font-bold"
                : "text-[#6e7a74] hover:text-[#3e4944]"
            }
          >
            {loc.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
