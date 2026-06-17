import Link from "next/link";
import Image from "next/image";
import type { PropertyRow } from "@/lib/supabase/queries";
import { ListingCardActions } from "./ListingCardActions";

interface ListingCardProps {
  property: PropertyRow;
  savedIds?: string[];
}

export function ListingCard({ property, savedIds = [] }: ListingCardProps) {
  const price = new Intl.NumberFormat("id-ID").format(property.price_monthly);
  const photos = property.photo_urls ?? [];
  const rla = property.rla_assessments?.[0];
  const isSaved = savedIds.includes(property.id);

  return (
    <article
      className="bg-white rounded-xl overflow-hidden group transition-all duration-300"
      style={{
        border: "1px solid #CCCCCC",
        boxShadow: "0px 4px 12px rgba(13, 33, 55, 0.05)",
      }}
    >
      <div className="relative aspect-video overflow-hidden">
        {photos[0] ? (
          <Image
            src={photos[0]}
            alt={property.name}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-[#e4e2e1] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#6e7a74] text-4xl">
              apartment
            </span>
          </div>
        )}

        <span className="absolute top-3 left-3 bg-[#e8f5f0] text-[#1a7a5e] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
          <span className="material-symbols-outlined text-[14px]">verified</span>
          Curated
        </span>

        <div className="absolute top-3 right-3 flex items-center gap-2">
          {rla?.rla_score && (
            <span className="bg-[#e8f5f0] text-[#1a7a5e] px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
              {Number(rla.rla_score).toFixed(1)}/5 ★
            </span>
          )}
          <ListingCardActions propertyId={property.id} initialSaved={isSaved} />
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-[#0d2137] leading-tight">
              {property.name}
            </h3>
            <div className="flex items-center text-[#3e4944] mt-1 gap-1">
              <span className="material-symbols-outlined text-sm">location_on</span>
              <span className="text-xs">{property.area}</span>
            </div>
          </div>
        </div>

        <div className="text-[#1a7a5e] text-xl font-bold">
          IDR {price}{" "}
          <span className="text-xs font-normal text-[#6e7a74]">/ month</span>
        </div>

        <div className="flex items-center gap-4 border-y border-[#bec9c2] py-3">
          <div className="flex items-center gap-1 text-[#3e4944]">
            <span className="material-symbols-outlined text-sm">straighten</span>
            <span className="text-xs">{property.size_sqm} m²</span>
          </div>
          <div className="flex items-center gap-1 text-[#3e4944]">
            <span className="material-symbols-outlined text-sm">bed</span>
            <span className="text-xs">{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1 text-[#3e4944]">
            <span className="material-symbols-outlined text-sm">bathtub</span>
            <span className="text-xs">{property.bathrooms}</span>
          </div>
        </div>

        <Link
          href={`/listings/${property.slug}`}
          className="block w-full text-center py-2.5 border-2 border-[#1a7a5e] text-[#1a7a5e] rounded-lg text-sm font-medium hover:bg-[#1a7a5e] hover:text-white transition-colors duration-300"
        >
          See Details
        </Link>
      </div>
    </article>
  );
}
