import Link from "next/link";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { PLACEHOLDER_PROPERTIES } from "@/lib/placeholder-data";
import { getCurrentUser } from "@/lib/supabase/get-current-user";

export const dynamic = "force-dynamic";

export default async function SavedListingsPage() {
  const user = await getCurrentUser();
  const savedProperties = PLACEHOLDER_PROPERTIES.slice(0, 3);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/saved" userName={user.name} isActiveClient={user.is_active_client} />

      <main className="flex-1 ml-72 p-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-[#0d2137] mb-1">Saved Listings</h2>
          <p className="text-[#3e4944]">{savedProperties.length} properties saved</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedProperties.map((p) => {
            const price = new Intl.NumberFormat("id-ID").format(p.price_per_month);
            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-[#cccccc] overflow-hidden shadow-sm group"
              >
                <div className="aspect-video bg-[#e4e2e1] relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#6e7a74] text-4xl">apartment</span>
                  <button className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-[#fee2e2]">
                    <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                      favorite
                    </span>
                  </button>
                  {p.rla_score && (
                    <span className="absolute bottom-3 left-3 bg-[#e8f5f0] text-[#1a7a5e] px-2 py-1 rounded-lg text-xs font-bold">
                      {p.rla_score}/5 ★
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="font-semibold text-[#0d2137]">{p.title}</h3>
                    <p className="text-xs text-[#3e4944]">{p.area}, {p.district}</p>
                  </div>
                  <p className="text-[#1a7a5e] text-xl font-bold">
                    IDR {price} <span className="text-xs font-normal text-[#6e7a74]">/ month</span>
                  </p>
                  <div className="flex gap-3">
                    <Link
                      href={`/listings/${p.slug}`}
                      className="flex-1 text-center py-2 border-2 border-[#1a7a5e] text-[#1a7a5e] rounded-lg text-sm font-medium hover:bg-[#1a7a5e] hover:text-white transition-colors"
                    >
                      View Details
                    </Link>
                    <Link
                      href="/consultation"
                      className="flex-1 text-center py-2 bg-[#1a7a5e] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Consult
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
