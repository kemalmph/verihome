"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { setLocale } from "@/lib/actions/locale";
import { LOCALES } from "@/lib/i18n/config";

/**
 * Previously this was `useState("EN")` and nothing else: the control
 * defaulted to English, the site was Indonesian, and clicking either side
 * changed which label was bold. A switch that moves but changes nothing is
 * not a smaller feature than a working one — it is a false statement about
 * the product, made at the top of every page.
 *
 * A form rather than onClick handlers, so it works before React hydrates.
 * That window is invisible on a development machine and long enough to tap
 * in on a phone, where a dead switch reads as a broken site.
 *
 * There is no early return for the language already showing. Before a
 * cookie exists the active language is only the default (English), so
 * pressing the one on screen is the visitor confirming it — and that
 * confirmation is exactly what needs storing.
 */
export function LanguageToggle() {
  const active = useLocale();

  return (
    <form
      action={setLocale}
      className="flex items-center bg-canvas px-3 py-1 rounded-full text-xs font-medium select-none"
    >
      {LOCALES.map((loc, i) => (
        <span key={loc} className="contents">
          {i > 0 && <span className="mx-2 text-line-strong">|</span>}
          <button
            type="submit"
            name="locale"
            value={loc}
            lang={loc}
            aria-pressed={active === loc}
            className={
              active === loc
                ? "text-brand-ink font-bold"
                : "text-ink-3 hover:text-ink-2"
            }
          >
            {loc.toUpperCase()}
          </button>
        </span>
      ))}
    </form>
  );
}
