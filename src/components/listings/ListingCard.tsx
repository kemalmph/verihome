import Link from "next/link";
import Image from "next/image";
import type { PropertyRow } from "@/lib/supabase/queries";
import { ListingCardActions } from "./ListingCardActions";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

interface ListingCardProps {
  property: PropertyRow;
  savedIds?: string[];
}

/**
 * One listing in a grid — V7 card: photo on top, cream-free white body,
 * soft border, lifts on hover.
 *
 * The whole card is the link (the title's ::after stretches over it), and the
 * save button sits above that layer with z-10 so pressing the heart saves
 * rather than navigates. A <button> inside an <a> would be invalid HTML; this
 * keeps them siblings.
 */
export async function ListingCard({ property, savedIds = [] }: ListingCardProps) {
  const lang = await getLocale();
  const price = new Intl.NumberFormat("id-ID").format(property.price_monthly);
  const photos = property.photo_urls ?? [];
  const rla = property.rla_assessments?.[0];
  const isSaved = savedIds.includes(property.id);

  const modeLabel =
    property.rental_mode === "short_stay" ? t("card.shortStay", lang)
    : property.rental_mode === "both" ? t("card.shortLong", lang)
    : null;

  return (
    <article className="group relative overflow-hidden rounded-[19px] bg-white border border-line shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
        {photos[0] ? (
          <Image
            src={photos[0]}
            alt={property.name}
            fill
            sizes="(min-width: 1024px) 370px, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-ink-3 text-4xl">apartment</span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm">
            <span aria-hidden className="material-symbols-outlined text-[14px] text-brand">verified</span>
            {t("card.curated", lang)}
          </span>
          {modeLabel && (
            <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
              {modeLabel}
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3 z-10">
          <ListingCardActions propertyId={property.id} initialSaved={isSaved} />
        </div>
      </div>

      <div className="p-[18px] md:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-ink">
            <span aria-hidden className="material-symbols-outlined text-[14px]">location_on</span>
            {property.area}
          </p>
          {rla?.rla_score != null && (
            // rla_score is the mean of eight 1–10 ratings (a generated column),
            // so it is out of 10. The card used to say "/5".
            <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-ink whitespace-nowrap">
              <span aria-hidden className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              {Number(rla.rla_score).toFixed(1)}
              <span className="font-medium text-ink-3">/10</span>
            </span>
          )}
        </div>

        <h3 className="mt-1.5 text-[17px] font-bold leading-snug tracking-[-0.02em] text-ink">
          <Link
            href={`/listings/${property.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-[19px] focus-visible:after:ring-2 focus-visible:after:ring-brand"
          >
            {property.name}
          </Link>
        </h3>

        <ul className="mt-2.5 flex items-center gap-4 text-[13px] text-ink-3">
          <li className="flex items-center gap-1">
            <span aria-hidden className="material-symbols-outlined text-[16px]">bed</span>
            {property.bedrooms}
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className="material-symbols-outlined text-[16px]">bathtub</span>
            {property.bathrooms}
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className="material-symbols-outlined text-[16px]">straighten</span>
            {property.size_sqm} m²
          </li>
        </ul>

        <div className="mt-4 pt-4 border-t border-line flex items-end justify-between gap-3">
          <p className="text-ink">
            <span className="text-lg font-extrabold tracking-[-0.02em]">IDR {price}</span>{" "}
            <span className="text-xs text-ink-3">{t("card.perMonth", lang)}</span>
          </p>
          <span aria-hidden className="text-sm font-bold text-brand-ink transition-transform group-hover:translate-x-0.5">
            {t("card.seeDetails", lang)} →
          </span>
        </div>
      </div>
    </article>
  );
}
