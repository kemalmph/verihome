import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListingCard } from "@/components/listings/ListingCard";
import { getFeaturedProperties } from "@/lib/supabase/queries";
import { getSavedPropertyIds } from "@/lib/supabase/save-actions";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

/**
 * The marketing homepage.
 *
 * Every link to the marketplace goes to /listings, plural. The copy this was
 * written from says /listing — that route does not exist and never has, so
 * following it literally would have put a 404 behind the two busiest buttons
 * on the page.
 */

export default async function HomePage() {
  const [featuredListings, savedIds, lang] = await Promise.all([
    getFeaturedProperties(3),
    getSavedPropertyIds(),
    getLocale(),
  ]);

  return (
    <>
      <Navbar />
      <main>
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="relative bg-[#0d2137] overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #9cf4d1 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 md:px-16 py-20 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#9cf4d1] border border-[#9cf4d1]/30 bg-[#9cf4d1]/10 rounded-full px-3 py-1.5">
                {t("home.hero.badge", lang)}
              </span>

              <h1 className="mt-6 text-4xl md:text-[3.25rem] md:leading-[1.1] font-bold text-white">
                {t("home.hero.title", lang)}
              </h1>

              <p className="mt-6 text-lg text-white/80 max-w-2xl">
                {t("home.hero.sub", lang)}
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="px-6 py-3.5 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
                >
                  {t("nav.contact", lang)}
                </Link>
                <Link
                  href="/listings"
                  className="px-6 py-3.5 rounded-lg border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors"
                >
                  {t("home.hero.browse", lang)}
                </Link>
              </div>

              <p className="mt-5 text-sm text-white/55">
                {t("home.hero.note", lang)}
              </p>
            </div>
          </div>
        </section>

        {/* ── Satu sistem untuk dua jenis aset ────────────────────── */}
        <section id="workspace-hunian" className="scroll-mt-20 py-20 md:py-24 max-w-7xl mx-auto px-4 md:px-16">
          <Eyebrow>{t("home.assets.eyebrow", lang)}</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
            {t("home.assets.title", lang)}
          </h2>
          <p className="mt-4 text-[#3e4944] text-lg max-w-3xl">
            {t("home.assets.sub", lang)}
          </p>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssetCard
              icon="desk"
              title={t("home.assets.work.title", lang)}
              description={t("home.assets.work.desc", lang)}
              points={[
                t("home.assets.work.p1", lang),
                t("home.assets.work.p2", lang),
                t("home.assets.work.p3", lang),
              ]}
            />
            <AssetCard
              icon="apartment"
              title={t("home.assets.live.title", lang)}
              description={t("home.assets.live.desc", lang)}
              points={[
                t("home.assets.live.p1", lang),
                t("home.assets.live.p2", lang),
                t("home.assets.live.p3", lang),
              ]}
            />
          </div>
        </section>

        {/* ── Fitur kelola & monetisasi ───────────────────────────── */}
        <section id="fitur-kelola" className="scroll-mt-20 bg-white py-20 md:py-24 border-y border-[#e4e2e1]">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            <Eyebrow>{t("home.ops.eyebrow", lang)}</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
              {t("home.ops.title", lang)}
            </h2>

            <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ValueBlock
                number="01"
                title={t("home.ops.b1.title", lang)}
                description={t("home.ops.b1.desc", lang)}
                highlights={[t("home.ops.b1.h1", lang), t("home.ops.b1.h2", lang)]}
              />
              <ValueBlock
                id="monetisasi"
                number="02"
                title={t("home.ops.b2.title", lang)}
                description={t("home.ops.b2.desc", lang)}
                highlights={[t("home.ops.b2.h1", lang), t("home.ops.b2.h2", lang)]}
                href="/listings"
                hrefLabel={t("home.ops.b2.link", lang)}
              />
              <ValueBlock
                number="03"
                title={t("home.ops.b3.title", lang)}
                description={t("home.ops.b3.desc", lang)}
                highlights={[t("home.ops.b3.h1", lang), t("home.ops.b3.h2", lang)]}
              />
            </div>
          </div>
        </section>

        {/* ── Cara kerja ──────────────────────────────────────────── */}
        <section id="cara-kerja" className="scroll-mt-20 py-20 md:py-24 max-w-7xl mx-auto px-4 md:px-16">
          <Eyebrow>{t("home.how.eyebrow", lang)}</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137]">
            {t("home.how.title", lang)}
          </h2>

          <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { t: t("home.how.s1t", lang), d: t("home.how.s1d", lang) },
              { t: t("home.how.s2t", lang), d: t("home.how.s2d", lang) },
              { t: t("home.how.s3t", lang), d: t("home.how.s3d", lang) },
            ].map((s, i) => (
              <li key={s.t}>
                <div className="w-11 h-11 rounded-full bg-[#1a7a5e] text-white font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-lg font-bold text-[#0d2137]">{s.t}</h3>
                <p className="mt-2 text-[#3e4944] leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Etalase listing aktif ───────────────────────────────── */}
        <section className="bg-[#f0eded] py-20 md:py-24">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            <Eyebrow>{t("home.show.eyebrow", lang)}</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
              {t("home.show.title", lang)}
            </h2>
            <p className="mt-4 text-[#3e4944] text-lg max-w-3xl">
              {t("home.show.sub", lang)}
            </p>

            {featuredListings.length > 0 ? (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredListings.map((p) => (
                  <ListingCard key={p.id} property={p} savedIds={savedIds} />
                ))}
              </div>
            ) : (
              /* An empty grid with a heading above it reads as a broken page.
                 Saying so plainly is better than three grey rectangles. */
              <p className="mt-12 text-[#6e7a74]">
                {t("home.show.empty", lang)}
              </p>
            )}

            <div className="mt-10">
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 text-[#1a7a5e] font-semibold hover:underline"
              >
                {t("home.show.all", lang)}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Skema harga ─────────────────────────────────────────── */}
        <section id="harga" className="scroll-mt-20 py-20 md:py-24 max-w-7xl mx-auto px-4 md:px-16">
          <Eyebrow>{t("home.price.eyebrow", lang)}</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
            {t("home.price.title", lang)}
          </h2>
          <p className="mt-4 text-[#3e4944] text-lg max-w-3xl">
            {t("home.price.sub", lang)}
          </p>

          <div className="mt-12 max-w-3xl bg-white border border-[#ddd7d4] rounded-2xl p-8 md:p-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1a7a5e]">
              {t("home.price.badge", lang)}
            </p>
            <p className="mt-2 text-2xl md:text-3xl font-bold text-[#0d2137]">
              {t("home.price.headline", lang)}
            </p>
            <p className="mt-4 text-[#3e4944] leading-relaxed">
              {t("home.price.desc", lang)}
            </p>

            <ul className="mt-7 space-y-3">
              {[
                t("home.price.f1", lang),
                t("home.price.f2", lang),
                t("home.price.f3", lang),
                t("home.price.f4", lang),
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-[#3e4944]">
                  <span className="material-symbols-outlined text-[#1a7a5e] text-xl leading-6">
                    check_circle
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/contact"
              className="mt-9 inline-block px-6 py-3.5 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
            >
              {t("home.price.cta", lang)}
            </Link>
          </div>
        </section>

        {/* ── Banner penutup ──────────────────────────────────────── */}
        <section className="bg-[#0d2137] py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 md:px-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white max-w-3xl mx-auto">
              {t("home.cta.title", lang)}
            </h2>
            <p className="mt-4 text-white/75 text-lg max-w-2xl mx-auto">
              {t("home.cta.sub", lang)}
            </p>
            <div className="mt-9 flex flex-wrap gap-3 justify-center">
              <Link
                href="/contact"
                className="px-6 py-3.5 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
              >
                {t("nav.contact", lang)}
              </Link>
              <Link
                href="/listings"
                className="px-6 py-3.5 rounded-lg border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                {t("home.cta.secondary", lang)}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1a7a5e]">
      {children}
    </p>
  );
}

function AssetCard({
  icon, title, description, points,
}: {
  icon: string; title: string; description: string; points: string[];
}) {
  return (
    <div className="bg-white border border-[#ddd7d4] rounded-2xl p-8 h-full">
      <span className="material-symbols-outlined text-[#1a7a5e] text-3xl">{icon}</span>
      <h3 className="mt-4 text-xl font-bold text-[#0d2137]">{title}</h3>
      <p className="mt-3 text-[#3e4944] leading-relaxed">{description}</p>
      <ul className="mt-6 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[#3e4944]">
            <span className="material-symbols-outlined text-[#1a7a5e] text-xl leading-6">
              check_circle
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ValueBlock({
  id, number, title, description, highlights, href, hrefLabel,
}: {
  id?: string;
  number: string;
  title: string;
  description: string;
  highlights: string[];
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div
      id={id}
      className="bg-[#f6f3f2] border border-[#e4e2e1] rounded-2xl p-7 h-full flex flex-col scroll-mt-28"
    >
      <span className="text-sm font-bold text-[#1a7a5e]">{number}</span>
      <h3 className="mt-3 text-lg font-bold text-[#0d2137]">{title}</h3>
      <p className="mt-3 text-[#3e4944] leading-relaxed flex-1">{description}</p>
      <ul className="mt-5 space-y-1.5">
        {highlights.map((h) => (
          <li key={h} className="text-sm text-[#1a7a5e] font-medium">
            • {h}
          </li>
        ))}
      </ul>
      {href && (
        <Link href={href} className="mt-5 text-sm font-semibold text-[#1a7a5e] hover:underline">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
