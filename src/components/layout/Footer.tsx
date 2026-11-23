import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { t, type StringKey } from "@/lib/i18n/strings";

/**
 * Every link here resolves.
 *
 * The previous footer pointed at /about, /terms, /privacy and /cookies —
 * none of which exist, so four of its twelve links were 404s sitting in the
 * footer of every page. /terms and /privacy now exist as real pages; /about
 * and /cookies are gone rather than left pointing at nothing.
 */
const COLUMNS: { heading: StringKey; links: { href: string; label: StringKey }[] }[] = [
  {
    heading: "footer.product",
    links: [
      { href: "/#workspace-hunian", label: "footer.manageWork" },
      { href: "/#workspace-hunian", label: "footer.manageLiving" },
      { href: "/listings", label: "footer.marketplace" },
      { href: "/#harga", label: "nav.pricing" },
    ],
  },
  {
    heading: "footer.tenants",
    links: [
      { href: "/listings", label: "footer.findCoworking" },
      { href: "/listings", label: "footer.findLiving" },
      { href: "/#cara-kerja", label: "footer.howToBook" },
    ],
  },
  {
    heading: "footer.company",
    links: [
      { href: "/contact", label: "nav.contact" },
      { href: "/list-your-property", label: "footer.listProperty" },
      { href: "/terms", label: "footer.terms" },
      { href: "/privacy", label: "footer.privacy" },
    ],
  },
];

export async function Footer() {
  const lang = await getLocale();

  return (
    <footer className="w-full bg-[#0d2137] text-[#e4e2e1]">
      <div className="max-w-7xl mx-auto px-4 md:px-16 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <h2 className="text-xl font-bold text-[#9cf4d1] mb-4">Cosystem</h2>
            <p className="text-sm text-[#bec9c2] leading-relaxed">
              {t("footer.tagline", lang)}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h5 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
                {t(col.heading, lang)}
              </h5>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={`${col.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#bec9c2] hover:text-[#9cf4d1] transition-colors"
                    >
                      {t(link.label, lang)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-[#bec9c2]/20">
          <p className="text-xs text-[#bec9c2]/70">
            © 2026 Cosystem. {t("footer.rights", lang)}
          </p>
        </div>
      </div>
    </footer>
  );
}
