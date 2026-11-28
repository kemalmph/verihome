import Link from "next/link";
import { t, type Lang } from "@/lib/i18n/strings";
import { PUBLIC_NAV } from "./nav-items";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

/**
 * The header on a phone and small tablet.
 *
 * Built on <details>, not a useState panel, so it opens before React has
 * hydrated and with no JavaScript at all: a menu that does nothing for the
 * first second of a slow connection reads as a broken site, and the menu is
 * the one control a stranded visitor reaches for.
 *
 * It mirrors the desktop header (PUBLIC_NAV) with the dropdowns flattened
 * into labelled groups, plus the language switch, which the bar hides
 * below 640px.
 */
export function NavMobileMenu({ lang }: { lang: Lang }) {
  return (
    <details className="lg:hidden relative">
      <summary
        aria-label={t("nav.menu", lang)}
        className="list-none cursor-pointer flex items-center justify-center w-10 h-10 rounded-full text-ink hover:bg-cream transition-colors [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden className="material-symbols-outlined">menu</span>
      </summary>

      <div className="absolute right-0 top-full mt-3 w-[19rem] max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto bg-white border border-line rounded-2xl shadow-lift z-30 p-2">
        {PUBLIC_NAV.map((entry) =>
          entry.kind === "link" ? (
            <Link
              key={entry.label}
              href={entry.href}
              className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-ink hover:bg-cream"
            >
              {t(entry.label, lang)}
            </Link>
          ) : (
            <div key={entry.label} className="py-1">
              <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-ink">
                {t(entry.label, lang)}
              </p>
              {entry.items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block px-3 py-2 rounded-xl text-sm font-medium text-ink-2 hover:bg-cream"
                >
                  {t(item.label, lang)}
                </Link>
              ))}
            </div>
          ),
        )}

        {/* Sign In is no longer repeated here: it is the header's own
            button at every width. The bar still hides the language switch
            below 640px, so it lives here instead. */}
        <div className="sm:hidden mt-1 px-3 py-2.5 border-t border-line flex">
          <LanguageToggle />
        </div>
      </div>
    </details>
  );
}
