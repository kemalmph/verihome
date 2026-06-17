import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListingCard } from "@/components/listings/ListingCard";
import { getLiveProperties } from "@/lib/supabase/queries";
import { getSavedPropertyIds } from "@/lib/supabase/save-actions";

interface ListingsPageProps {
  searchParams: Promise<{
    area?: string;
    type?: string;
    min_price?: string;
    max_price?: string;
  }>;
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const filters = await searchParams;

  const [properties, savedIds] = await Promise.all([
    getLiveProperties({
      area: filters.area,
      type: filters.type,
      minPrice: filters.min_price ? parseInt(filters.min_price) : undefined,
      maxPrice: filters.max_price ? parseInt(filters.max_price) : undefined,
    }),
    getSavedPropertyIds(),
  ]);

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-16 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-[#1b1c1c] mb-1">
            All Listings
          </h1>
          <p className="text-lg text-[#3e4944]">
            Only verified, curated properties.
          </p>
        </header>

        {/* Filter Bar */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-6 mb-12 shadow-sm">
          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#3e4944]">Area</label>
              <select
                name="area"
                defaultValue={filters.area ?? ""}
                className="w-full h-11 border border-[#bec9c2] rounded-lg bg-white px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              >
                <option value="">All Areas</option>
                {["Senayan", "Kemang", "SCBD", "Sudirman", "Kuningan", "Menteng"].map(
                  (a) => (
                    <option key={a} value={a.toLowerCase()}>
                      {a}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#3e4944]">
                Property Type
              </label>
              <select
                name="type"
                defaultValue={filters.type ?? ""}
                className="w-full h-11 border border-[#bec9c2] rounded-lg bg-white px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              >
                <option value="">All Types</option>
                <option value="kost">Kost</option>
                <option value="apartment">Apartment</option>
                <option value="house">House</option>
                <option value="villa">Villa</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#3e4944]">
                Min Price (IDR)
              </label>
              <input
                type="number"
                name="min_price"
                defaultValue={filters.min_price ?? ""}
                placeholder="2,000,000"
                className="w-full h-11 border border-[#bec9c2] rounded-lg bg-white px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#3e4944]">
                Max Price (IDR)
              </label>
              <input
                type="number"
                name="max_price"
                defaultValue={filters.max_price ?? ""}
                placeholder="20,000,000"
                className="w-full h-11 border border-[#bec9c2] rounded-lg bg-white px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              />
            </div>

            <button
              type="submit"
              className="h-11 bg-[#1a7a5e] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
            >
              Apply Filters
            </button>
          </form>
        </section>

        {/* Listings Grid */}
        {properties.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-[#bec9c2] block mb-4">
              search_off
            </span>
            <h3 className="text-xl font-semibold text-[#1b1c1c] mb-2">
              No listings found
            </h3>
            <p className="text-[#3e4944]">
              Try adjusting your filters to see more results.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <ListingCard key={property.id} property={property} savedIds={savedIds} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
