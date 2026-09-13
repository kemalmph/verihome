import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RentalMode } from "@/types/property";

export const dynamic = "force-dynamic";

function modeLabel(m: RentalMode) {
  if (m === "both")       return "Long-term + Short stay";
  if (m === "short_stay") return "Short stay only";
  return "Long-term only";
}

function modeColor(m: RentalMode) {
  if (m === "both")       return "bg-purple-100 text-purple-700";
  if (m === "short_stay") return "bg-blue-100 text-blue-700";
  return "bg-[#e8f5f0] text-[#1a7a5e]";
}

export default async function AdminInventoryPage() {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: properties } = await admin
    .from("properties")
    .select(`
      id, name, area, status, rental_mode, is_furnished, is_instant_bookable,
      short_stay_rates ( price_per_night, active ),
      availability_blocks ( start_date, end_date )
    `)
    .order("name");

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/inventory" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0d2137]">Inventory</h1>
          <p className="text-[#6e7a74] text-sm mt-1">All properties with rental mode and short-stay status</p>
        </div>

        <div className="overflow-x-auto bg-white rounded-xl border border-[#cccccc]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#cccccc] text-[#6e7a74] text-xs uppercase">
                <th className="text-left py-3 px-4">Property</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Rental Mode</th>
                <th className="text-left py-3 px-4">Short-stay Rate</th>
                <th className="text-left py-3 px-4">Currently Blocked</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(properties ?? []).map((p) => {
                const mode       = (p.rental_mode ?? "long_term") as RentalMode;
                const rate       = p.short_stay_rates as unknown as { price_per_night: number; active: boolean } | null;
                const blocks     = (p.availability_blocks as { start_date: string; end_date: string }[]) ?? [];
                const isBlocked  = blocks.some((b) => b.start_date <= today && b.end_date > today);

                return (
                  <tr key={p.id} className="border-b border-[#f6f3f2] hover:bg-[#f6f3f2]">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0d2137]">{p.name}</div>
                      <div className="text-xs text-[#6e7a74]">{p.area}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs capitalize text-[#3e4944]">{p.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${modeColor(mode)}`}>
                        {modeLabel(mode)}
                      </span>
                      {p.is_instant_bookable && (
                        <span className="ml-1 text-xs text-amber-600">⚡ Instant</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {rate ? (
                        <span className={rate.active ? "text-green-700 font-semibold" : "text-[#6e7a74] line-through"}>
                          IDR {new Intl.NumberFormat("id-ID").format(rate.price_per_night)}/night
                        </span>
                      ) : (
                        <span className="text-[#cccccc]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold ${isBlocked ? "text-red-600" : "text-green-600"}`}>
                        {isBlocked ? "Blocked" : "Available"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/listings/${p.id}/build`}
                        className="text-xs text-[#1a7a5e] hover:underline"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
