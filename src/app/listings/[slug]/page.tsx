import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RLAScore } from "@/components/listings/RLAScore";
import { PhotoGallery, type CategorizedPhotos } from "@/components/listings/PhotoGallery";
import { getPropertyBySlug, getLiveSlugs } from "@/lib/supabase/queries";
import { getSavedPropertyIds } from "@/lib/supabase/save-actions";
import { SaveButton } from "@/components/listings/SaveButton";

export async function generateStaticParams() {
  const slugs = await getLiveSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface ListingDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { slug } = await params;
  const [property, savedIds] = await Promise.all([
    getPropertyBySlug(slug),
    getSavedPropertyIds(),
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

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-16 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-6 text-sm text-[#3e4944]">
          <Link href="/" className="hover:text-[#1a7a5e]">Home</Link>
          <span className="material-symbols-outlined text-sm text-[#6e7a74]">chevron_right</span>
          <Link href="/listings" className="hover:text-[#1a7a5e]">Listings</Link>
          <span className="material-symbols-outlined text-sm text-[#6e7a74]">chevron_right</span>
          <span className="text-[#1b1c1c] font-medium truncate max-w-xs">{property.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-10">
            {/* Photos */}
            <PhotoGallery photos={flatPhotos} categorized={categorized} title={property.name} />

            {/* Property Header */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                  <div className="flex items-start gap-3">
                    <h1 className="text-3xl font-bold text-[#1b1c1c]">{property.name}</h1>
                    <SaveButton propertyId={property.id} initialSaved={isSaved} size="md" />
                  </div>
                  <div className="flex items-center gap-1 text-[#3e4944] mt-1">
                    <span className="material-symbols-outlined text-[#1a7a5e] text-lg">location_on</span>
                    {property.area} · {property.address}
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-[#1a7a5e] text-2xl font-bold">IDR {price}</div>
                  <div className="text-[#3e4944] text-sm">per month</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 py-4 border-y border-[#bec9c2]">
                {[
                  { icon: "bed", value: `${property.bedrooms} Beds` },
                  { icon: "bathtub", value: `${property.bathrooms} Baths` },
                  { icon: "square_foot", value: `${property.size_sqm} m²` },
                  { icon: "calendar_today", value: `Min ${property.min_stay_months} months` },
                ].map((item) => (
                  <div key={item.icon} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#6e7a74]">{item.icon}</span>
                    <span className="text-[#1b1c1c]">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* RLA Assessment */}
            {rla && <RLAScore assessment={rla} />}

            {/* Pros & Cons */}
            {rla && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-[#cccccc]">
                  <h3 className="text-lg font-semibold text-[#1a7a5e] mb-4">Pros</h3>
                  <ul className="space-y-3">
                    {(rla.pros as string[]).map((pro) => (
                      <li key={pro} className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[#1a7a5e]">check_circle</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-[#f6f3f2] p-6 rounded-xl border border-[#cccccc]">
                  <h3 className="text-lg font-semibold text-[#3e4944] mb-4">Cons</h3>
                  <ul className="space-y-3">
                    {(rla.cons as string[]).map((con) => (
                      <li key={con} className="flex items-start gap-3 text-[#3e4944]">
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
                <h2 className="text-lg font-semibold text-[#1b1c1c]">Facilities & House Rules</h2>
                <div className="flex flex-wrap gap-2">
                  {(details.facilities as string[]).map((f) => (
                    <span key={f} className="bg-[#e4e2e1] text-[#3e4944] px-3 py-1.5 rounded-lg text-sm border border-[#bec9c2]">
                      {f}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-2">Included</h4>
                    <ul className="space-y-1 text-sm">
                      {(details.included_utilities as string[]).map((u) => <li key={u}>• {u}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-2">House Rules</h4>
                    <p className="text-sm text-[#3e4944]">{details.rules}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Area Overview */}
            {area && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-[#1b1c1c]">Area Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 rounded-xl bg-[#e4e2e1] h-56 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#6e7a74] text-5xl">map</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: area.nearest_mrt, value: area.mrt_distance ?? (area.walk_time_to_transit_min ? `${area.walk_time_to_transit_min} min walk` : null) },
                      area.nearest_transjakarta ? { label: area.nearest_transjakarta, value: area.transjakarta_distance } : null,
                      { label: area.nearest_minimarket, value: null },
                      { label: area.nearest_clinic, value: null },
                      area.nearest_food ? { label: area.nearest_food, value: null } : null,
                      area.nearest_gym  ? { label: area.nearest_gym,  value: null } : null,
                    ].filter(Boolean).map((place) => (
                      <div key={place!.label} className="bg-white p-3 rounded-xl border border-[#cccccc] flex justify-between items-center">
                        <span className="text-sm text-[#1b1c1c]">{place!.label}</span>
                        {place!.value && <span className="text-sm font-bold text-[#1a7a5e]">{place!.value}</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-6 p-4 bg-[#cee1ff]/20 rounded-lg border border-[#cee1ff]">
                  <span className="text-sm text-[#52647d] capitalize">{area.neighborhood_character} neighborhood</span>
                  <span className="text-sm text-[#52647d] font-bold whitespace-nowrap">
                    SCBD: {area.time_to_scbd_min} min · Sudirman: {area.time_to_sudirman_min} min
                  </span>
                  {area.expat_friendly != null && (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-xs text-[#52647d]">Expat-friendly</span>
                      <span className="text-sm font-bold text-[#1a7a5e]">{area.expat_friendly}/10</span>
                      <div className="w-16 bg-[#e4e2e1] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#1a7a5e] h-full rounded-full" style={{ width: `${(area.expat_friendly / 10) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {area.area_notes && (
                  <p className="text-sm text-[#3e4944] italic">{area.area_notes}</p>
                )}
              </section>
            )}
          </div>

          {/* Sticky Sidebar */}
          <aside className="lg:col-span-4 sticky top-24 space-y-6">
            <div className="bg-white border border-[#cccccc] rounded-xl p-6 shadow-sm">
              <div className="mb-6">
                <div className="text-xs text-[#3e4944] mb-1">Starting from</div>
                <div className="text-[#1a7a5e] text-3xl font-bold">IDR {price}</div>
                <div className="text-xs text-[#3e4944]">per month + utilities</div>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  { label: "Min stay", value: `${property.min_stay_months} Months` },
                  { label: "Property type", value: property.property_type },
                  { label: "Size", value: `${property.size_sqm} m²` },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center pb-3 border-b border-[#bec9c2] last:border-0">
                    <span className="text-[#3e4944] text-sm">{item.label}</span>
                    <span className="text-[#1b1c1c] font-bold text-sm capitalize">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <Link
                  href="/consultation"
                  className="w-full bg-[#1a7a5e] text-white py-4 rounded-lg font-semibold flex flex-col items-center hover:opacity-90 transition-opacity"
                >
                  <span>Book a Consultation</span>
                  <span className="text-xs font-normal opacity-80">Get independent advice before you commit</span>
                </Link>
                <button className="w-full border-2 border-[#0d2137] text-[#0d2137] py-4 rounded-lg font-semibold flex flex-col items-center hover:bg-[#f6f3f2] transition-colors">
                  <span>Request a Viewing</span>
                  <span className="text-xs font-normal opacity-70">Schedule a physical visit</span>
                </button>
              </div>
            </div>

            <div className="bg-[#0d2137] text-white p-6 rounded-xl space-y-3">
              <h4 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[#9cf4d1]">verified_user</span>
                VeriHome Guarantee
              </h4>
              <p className="text-sm opacity-90 leading-relaxed">
                We independently audit every listing. If the property doesn&apos;t match our RLA assessment upon arrival, we offer a full deposit refund.
              </p>
              <a href="#" className="text-[#9cf4d1] text-sm font-bold hover:underline">
                Learn about our protection →
              </a>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
