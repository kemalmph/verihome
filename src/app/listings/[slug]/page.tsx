import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RLAScore } from "@/components/listings/RLAScore";
import { PhotoGallery, type CategorizedPhotos } from "@/components/listings/PhotoGallery";
import { BookingOptions } from "@/components/listings/BookingOptions";
import { getPropertyBySlug } from "@/lib/supabase/queries";
import { getSavedPropertyIds } from "@/lib/supabase/save-actions";
import { SaveButton } from "@/components/listings/SaveButton";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

/**
 * This route renders per request, and says so rather than letting the build
 * work it out.
 *
 * It used to carry `revalidate = 60` and a `generateStaticParams`, which made
 * the rendering mode depend on what was in the database *at build time*:
 *
 *   - live listings present -> Next.js attempts a prerender, discovers that
 *     getSavedPropertyIds() reads cookies, and marks the route dynamic. Works.
 *   - no live listings       -> generateStaticParams returns [], nothing is
 *     ever rendered, the cookie read is never discovered, and the route stays
 *     static. Every request then renders on demand and throws
 *     DYNAMIC_SERVER_USAGE — a 500 on every listing page, and a 500 instead of
 *     a 404 for an unknown slug.
 *
 * `dynamic = 'auto'` is the default and means "cache as much as possible
 * without preventing dynamic behaviour", which is how one empty table turned
 * into two different rendering modes. Production happened to take the working
 * branch; a fresh environment, or a database briefly unreachable during a
 * build, takes the other one. Reproduced both ways on 2026-11-21.
 *
 * force-dynamic is what production already does, now stated instead of
 * inferred. It is not a performance decision and does not make these pages
 * slower than they are today.
 *
 * If the listing pages should be prerendered for SEO — a fair argument, they
 * are the most-visited pages here — the cookie read has to move to the client
 * first: SaveButton would fetch its own saved state, and only then can this
 * route go back to ISR. That is a real change with its own tests, not a
 * config line.
 */
export const dynamic = "force-dynamic";

interface ListingDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { slug } = await params;
  const [property, savedIds, lang] = await Promise.all([
    getPropertyBySlug(slug),
    getSavedPropertyIds(),
    getLocale(),
  ]);

  if (!property) notFound();

  const price = new Intl.NumberFormat("id-ID").format(property.price_monthly);
  const isSaved = savedIds.includes(property.id);
  const rla = property.rla_assessments?.[0];
  const details = property.property_details?.[0];
  const area = property.area_overviews?.[0];
  const media = property.property_media?.[0];

  // Prefer categorized photos from property_media, fall back to flat photo_urls
  const categorized: CategorizedPhotos | undefined = media
    ? {
        exterior:   (media.photos_exterior   as string[]) ?? [],
        commonArea: (media.photos_common_area as string[]) ?? [],
        unit:       (media.photos_unit        as string[]) ?? [],
        bathroom:   (media.photos_bathroom    as string[]) ?? [],
      }
    : undefined;
  const flatPhotos = property.photo_urls ?? [];
  const videoUrl = (media as { video_url?: string | null } | undefined)?.video_url ?? null;

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-16 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-6 text-sm text-ink-2">
          <Link href="/" className="hover:text-brand-ink">{t("detail.home", lang)}</Link>
          <span className="material-symbols-outlined text-sm text-ink-3">chevron_right</span>
          <Link href="/listings" className="hover:text-brand-ink">{t("detail.listings", lang)}</Link>
          <span className="material-symbols-outlined text-sm text-ink-3">chevron_right</span>
          <span className="text-ink font-medium truncate max-w-xs">{property.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-10">
            {/* Photos */}
            <PhotoGallery photos={flatPhotos} categorized={categorized} title={property.name} videoUrl={videoUrl} />

            {/* Property Header */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                  <div className="flex items-start gap-3">
                    <h1 className="text-3xl font-bold text-ink">{property.name}</h1>
                    <SaveButton propertyId={property.id} initialSaved={isSaved} size="md" />
                  </div>
                  {/* Area only. The exact address is disclosed after a booking
                      is confirmed — see the guest unit page — so that the
                      arrangement stays on the platform and an occupied home's
                      location is not published to anyone who loads the page. */}
                  <div className="flex items-center gap-1 text-ink-2 mt-1">
                    <span className="material-symbols-outlined text-brand-ink text-lg">location_on</span>
                    {property.area}
                  </div>
                  <p className="text-xs text-ink-3 mt-1">
                    {t("detail.addressNote", lang)}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-brand-ink text-2xl font-bold">IDR {price}</div>
                  <div className="text-ink-2 text-sm">{t("detail.perMonth", lang)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 py-4 border-y border-line-strong">
                {[
                  { icon: "bed", value: `${property.bedrooms} ${t("detail.beds", lang)}` },
                  { icon: "bathtub", value: `${property.bathrooms} ${t("detail.baths", lang)}` },
                  { icon: "square_foot", value: `${property.size_sqm} m²` },
                  { icon: "calendar_today", value: `${t("detail.minMonths", lang)} ${property.min_stay_months} ${t("detail.months", lang)}` },
                ].map((item) => (
                  <div key={item.icon} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-ink-3">{item.icon}</span>
                    <span className="text-ink">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* RLA Assessment */}
            {rla && <RLAScore assessment={rla} />}

            {/* Pros & Cons */}
            {rla && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-line-strong">
                  <h3 className="text-lg font-semibold text-brand-ink mb-4">{t("detail.pros", lang)}</h3>
                  <ul className="space-y-3">
                    {(rla.pros as string[]).map((pro) => (
                      <li key={pro} className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-brand-ink">check_circle</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-canvas p-6 rounded-xl border border-line-strong">
                  <h3 className="text-lg font-semibold text-ink-2 mb-4">{t("detail.cons", lang)}</h3>
                  <ul className="space-y-3">
                    {(rla.cons as string[]).map((con) => (
                      <li key={con} className="flex items-start gap-3 text-ink-2">
                        <span className="material-symbols-outlined">cancel</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Facilities */}
            {details && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-ink">{t("detail.facilities", lang)}</h2>
                <div className="flex flex-wrap gap-2">
                  {(details.facilities as string[]).map((f) => (
                    <span key={f} className="bg-line text-ink-2 px-3 py-1.5 rounded-lg text-sm border border-line-strong">
                      {f}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div>
                    <h4 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-2">{t("detail.included", lang)}</h4>
                    <ul className="space-y-1 text-sm">
                      {(details.included_utilities as string[]).map((u) => <li key={u}>• {u}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-2">{t("detail.houseRules", lang)}</h4>
                    <p className="text-sm text-ink-2">{details.rules}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Area Overview */}
            {area && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-ink">{t("detail.areaOverview", lang)}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 rounded-xl bg-line h-56 flex items-center justify-center">
                    <span className="material-symbols-outlined text-ink-3 text-5xl">map</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: area.nearest_mrt, value: area.mrt_distance ?? (area.walk_time_to_transit_min ? `${area.walk_time_to_transit_min} ${t("detail.minWalk", lang)}` : null) },
                      area.nearest_transjakarta ? { label: area.nearest_transjakarta, value: area.transjakarta_distance } : null,
                      { label: area.nearest_minimarket, value: null },
                      { label: area.nearest_clinic, value: null },
                      area.nearest_food ? { label: area.nearest_food, value: null } : null,
                      area.nearest_gym  ? { label: area.nearest_gym,  value: null } : null,
                    ].filter(Boolean).map((place) => (
                      <div key={place!.label} className="bg-white p-3 rounded-xl border border-line-strong flex justify-between items-center">
                        <span className="text-sm text-ink">{place!.label}</span>
                        {place!.value && <span className="text-sm font-bold text-brand-ink">{place!.value}</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-6 p-4 bg-[#cee1ff]/20 rounded-lg border border-[#cee1ff]">
                  <span className="text-sm text-[#52647d] capitalize">{area.neighborhood_character} {t("detail.neighborhood", lang)}</span>
                  <span className="text-sm text-[#52647d] font-bold whitespace-nowrap">
                    SCBD: {area.time_to_scbd_min} {t("detail.min", lang)} · Sudirman: {area.time_to_sudirman_min} {t("detail.min", lang)}
                  </span>
                  {area.expat_friendly != null && (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-xs text-[#52647d]">{t("detail.expatFriendly", lang)}</span>
                      <span className="text-sm font-bold text-brand-ink">{area.expat_friendly}/10</span>
                      <div className="w-16 bg-line h-1.5 rounded-full overflow-hidden">
                        <div className="bg-brand h-full rounded-full" style={{ width: `${(area.expat_friendly / 10) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {area.area_notes && (
                  <p className="text-sm text-ink-2 italic">{area.area_notes}</p>
                )}
              </section>
            )}
          </div>

          {/* Sticky Sidebar */}
          <aside className="lg:col-span-4 sticky top-24 space-y-6">
            {/* Property quick-facts */}
            <div className="bg-white border border-line-strong rounded-xl p-4 shadow-sm">
              <div className="space-y-2">
                {[
                  { label: t("detail.propertyType", lang), value: property.property_type },
                  { label: t("detail.size", lang), value: `${property.size_sqm} m²` },
                  { label: t("detail.furnished", lang), value: property.is_furnished ? t("detail.yes", lang) : t("detail.no", lang) },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center pb-2 border-b border-line-strong last:border-0">
                    <span className="text-ink-2 text-sm">{item.label}</span>
                    <span className="text-ink font-bold text-sm capitalize">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <BookingOptions
              propertyId={property.id}
              slug={property.slug}
              rentalMode={property.rental_mode ?? "long_term"}
              priceMonthly={property.price_monthly}
              minStayMonths={property.min_stay_months}
              isInstantBookable={property.is_instant_bookable ?? false}
              shortStayRate={property.short_stay_rates ?? null}
            />

            <div className="bg-ink text-white p-6 rounded-xl space-y-3">
              <h4 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-brand">verified_user</span>
                {t("detail.guarantee", lang)}
              </h4>
              <p className="text-sm opacity-90 leading-relaxed">
                {t("detail.guaranteeBody", lang)}
              </p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
