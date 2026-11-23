import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

export const metadata = { title: "Syarat & Ketentuan — Cosystem" };

/**
 * A placeholder, said plainly.
 *
 * The footer links here, and a 404 under "Syarat & Ketentuan" looks like a broken
 * site. Inventing legal text would be worse than either: it would be text
 * nobody wrote, nobody reviewed, and that the business would nonetheless be
 * held to. So the page exists, says what it is, and offers a way to ask.
 */
export default async function Page() {
  const lang = await getLocale();

  return (
    <>
      <Navbar />
      <main className="bg-[#f6f3f2] min-h-[60vh]">
        <div className="max-w-3xl mx-auto px-4 md:px-16 py-16 md:py-24">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0d2137]">{t("legal.terms.title", lang)}</h1>
          <p className="mt-6 text-[#3e4944] text-lg leading-relaxed">
            {t("legal.pending", lang)}
          </p>
          <p className="mt-4 text-[#3e4944] leading-relaxed">
            {t("legal.meanwhile", lang)}
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block px-5 py-3 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
          >
            {t("nav.contact", lang)}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
