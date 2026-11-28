import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { getLocale } from "@/lib/i18n/server";
import { t, type StringKey } from "@/lib/i18n/strings";

/**
 * The public footer (prototype V7): one quiet row — wordmark, tagline,
 * links, copyright.
 *
 * The V7 copy lists Product, Solutions and Contact. Terms and Privacy are
 * kept beside them: they are real pages, and a public site that takes
 * bookings and payments should not hide its legal terms.
 */
const LINKS: { href: string; label: StringKey }[] = [
  { href: "/#features", label: "footer.product" },
  { href: "/#solutions", label: "footer.solutions" },
  { href: "/contact", label: "footer.contact" },
  { href: "/terms", label: "footer.terms" },
  { href: "/privacy", label: "footer.privacy" },
];

export async function Footer() {
  const lang = await getLocale();

  return (
    <footer id="footer" className="w-full border-t border-line bg-white text-[13px] text-ink-3">
      <div className="max-w-[1160px] mx-auto px-4 md:px-6 py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-5">
        <Link href="/" aria-label="Cosystem" className="shrink-0">
          <Logo height={22} />
        </Link>
        <p>{t("footer.tagline", lang)}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="hover:text-ink transition-colors">
              {t(l.label, lang)}
            </Link>
          ))}
        </nav>
        <p>© 2026 Cosystem</p>
      </div>
    </footer>
  );
}
