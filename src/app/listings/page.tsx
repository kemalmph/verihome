import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListingCard } from "@/components/listings/ListingCard";
import { getLiveProperties } from "@/lib/supabase/queries";
import { getSavedPropertyIds } from "@/lib/supabase/save-actions";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";
import { pill, kicker } from "@/components/brand/styles";

interface ListingsPageProps {
  searchParams: Promise<{
    area?: string;
    type?: string;
    min_price?: string;
    max_price?: string;
    mode?: string;
  }>;
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const filters = await searchParams;

  const [properties, savedIds, lang] = await Promise.all([
    getLiveProperties({
      area: filters.area,
      type: filters.type,
      minPrice: filters.min_price ? parseInt(filters.min_price) : undefined,
      maxPrice: filters.max_price ? parseInt(filters.max_price) : undefined,
      rentalMode: filters.mode,
    }),
    getSavedPropertyIds(),
    getLocale(),
  ]);

  return (
    <>
      <Navbar />
      <main className="bg-white">
        {/* ── Header ─────────────────────────────────────────────── */}
        <section className="bg-cream-2 border-b border-line">
          <div className="max-w-[1160px] mx-auto px-4 md:px-6 pt-10 pb-24 md:pt-14 md:pb-28">
            <p className={kicker}>{t("nav.r.marketplace", lang)}</p>
            <h1 className="mt-3 text-[36px] md:text-[48px] leading-[1.02] font-extrabold tracking-[-0.045em] text-ink">
              {t("listings.title", lang)}
            </h1>
            <p className="mt-3 text-base md:text-lg text-ink-3 max-w-xl">
              {t("listings.sub", lang)}
            </p>
          </div>
        </section>

        <div className="max-w-[1160px] mx-auto px-4 md:px-6">
          {/* ── Filter ─────────────────────────────────────────────
              Pulled up over the header band so it reads as the tool for
              this page, not as one more section. A plain GET form: it
              works before hydration and the filters live in the URL. */}
          <section className="-mt-16 relative bg-white rounded-3xl border border-line shadow-lift p-5 md:p-6">
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4 items-end">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink-2">{t("listings.area", lang)}</span>
                <select name="area" defaultValue={filters.area ?? ""} className="w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                  <option value="">{t("listings.allAreas", lang)}</option>
                  {["Senayan", "Kemang", "SCBD", "Sudirman", "Kuningan", "Menteng"].map((a) => (
                    <option key={a} value={a.toLowerCase()}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink-2">{t("listings.type", lang)}</span>
                <select name="type" defaultValue={filters.type ?? ""} className="w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                  <option value="">{t("listings.allTypes", lang)}</option>
                  <option value="kost">{t("listings.typeKost", lang)}</option>
                  <option value="apartment">{t("listings.typeApartment", lang)}</option>
                  <option value="house">{t("listings.typeHouse", lang)}</option>
                  <option value="villa">{t("listings.typeVilla", lang)}</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink-2">{t("listings.minPrice", lang)}</span>
                <input
                  type="number"
                  name="min_price"
                  inputMode="numeric"
                  defaultValue={filters.min_price ?? ""}
                  placeholder="2,000,000"
                  className="w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink-2">{t("listings.maxPrice", lang)}</span>
                <input
                  type="number"
                  name="max_price"
                  inputMode="numeric"
                  defaultValue={filters.max_price ?? ""}
                  placeholder="20,000,000"
                  className="w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>

              <button type="submit" className={`${pill.primary} h-12 py-0 w-full lg:w-auto`}>
                <span aria-hidden className="material-symbols-outlined text-[18px]">search</span>
                {t("listings.apply", lang)}
              </button>
            </form>
          </section>

          <div className="pt-10 pb-14 md:pt-12 md:pb-20">
        {/* Listings Grid */}
        {properties.length === 0 ? (
          <div className="text-center py-16 rounded-3xl bg-cream border border-[#f3e9df]">
            <span className="mx-auto mb-4 grid place-items-center w-[54px] h-[54px] rounded-[17px] bg-brand-soft">
              <span aria-hidden className="material-symbols-outlined text-brand">search_off</span>
            </span>
            <h3 className="text-xl font-bold tracking-[-0.02em] text-ink mb-2">
              {t("listings.emptyTitle", lang)}
            </h3>
            <p className="text-ink-3">
              {t("listings.emptyBody", lang)}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((property) => (
              <ListingCard key={property.id} property={property} savedIds={savedIds} />
            ))}
          </div>
        )}
          </div>

          {/* ── Owner prompt ───────────────────────────────────────
              An owner who lands on the renters' page needs one way back to
              the operator side. Moved below the results: it used to sit
              above the page title, ahead of what a renter came for. */}
          <section className="pb-14 md:pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 rounded-3xl bg-[#fff2e7] border border-[#ffead9] p-6 md:px-[34px] md:py-7">
              <p className="text-[15px] text-ink-2 max-w-2xl">{t("listings.ownerBanner", lang)}</p>
              <Link href="/contact" className={`${pill.primary} w-full md:w-auto shrink-0`}>
                {t("nav.contact", lang)} <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
