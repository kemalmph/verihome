import Link from "next/link";
import { t, type Lang, type StringKey } from "@/lib/i18n/strings";

/**
 * The header on a phone.
 *
 * The desktop links are `hidden md:flex`, so below 768px the header held a
 * logo, a language switch and a Sign Up button — and no way to reach
 * anything. Fitur and Harga were not merely cramped on a phone, they were
 * absent.
 *
 * Built on <details>, not a useState panel, so it opens before React has
 * hydrated and with no JavaScript at all. The language switch taught this
 * the hard way: a control that does nothing for the first second of a slow
 * connection reads as a broken site, and a menu is the one control a
 * stranded visitor reaches for.
 *
 * It mirrors the desktop header exactly — the three Fitur sections and
 * Harga. Nothing extra is smuggled in here just because the panel is
 * hidden.
 */
const ITEMS: { href: string; label: StringKey; blurb?: StringKey }[] = [
  { href: "/#fitur-kelola",     label: "nav.feat.manage",   blurb: "nav.feat.manageBlurb" },
  { href: "/#monetisasi",       label: "nav.feat.monetise", blurb: "nav.feat.monetiseBlurb" },
  { href: "/#workspace-hunian", label: "nav.feat.assets",   blurb: "nav.feat.assetsBlurb" },
  { href: "/#harga",            label: "nav.pricing" },
];

export function NavMobileMenu({ lang, signedIn }: { lang: Lang; signedIn: boolean }) {
  return (
    <details className="md:hidden relative group">
      <summary
        aria-label={t("nav.menu", lang)}
        className="list-none cursor-pointer flex items-center justify-center w-10 h-10 -ml-1 rounded-lg text-[#3e4944] hover:bg-[#f6f3f2] transition-colors [&::-webkit-details-marker]:hidden"
      >
        {/* One icon, not a menu/close pair. The pair was tried first and
            rendered both at once: Tailwind's group-open: variant did not
            apply to these children, so neither icon was ever hidden. A
            swap that needs a variant to be right is not worth the risk for
            a glyph — tapping the button again closes the panel either way. */}
        <span aria-hidden className="material-symbols-outlined">menu</span>
      </summary>

      <div className="absolute left-0 top-full mt-2 w-[17rem] max-w-[calc(100vw-2rem)] bg-white border border-[#cccccc] rounded-xl shadow-lg z-30 overflow-hidden py-1">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-4 py-3 hover:bg-[#f6f3f2] transition-colors"
          >
            <span className="block text-sm font-semibold text-[#0d2137]">
              {t(item.label, lang)}
            </span>
            {item.blurb && (
              <span className="block mt-0.5 text-xs text-[#6e7a74] leading-snug">
                {t(item.blurb, lang)}
              </span>
            )}
          </Link>
        ))}

        {/* "Masuk" lives here on a phone because the bar has no room for it:
            at 390px a burger, a wordmark, the language switch and two
            account controls overflow, and "Daftar" was clipped. A returning
            visitor would otherwise have to guess the URL — or press
            "Daftar", which is a sign-up label for a sign-in need. */}
        {!signedIn && (
          <Link
            href="/auth/login"
            className="block px-4 py-3 border-t border-[#e4e2e1] text-sm font-semibold text-[#1a7a5e] hover:bg-[#f6f3f2] transition-colors"
          >
            {t("nav.signIn", lang)}
          </Link>
        )}
      </div>
    </details>
  );
}
