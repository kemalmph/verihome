import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusSelect } from "./StatusSelect";

interface AdminListingsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminListingsPage({ searchParams }: AdminListingsPageProps) {
  const { status } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("properties")
    .select("id, name, slug, area, property_type, price_monthly, status, created_at")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);

  const { data: properties } = await query;
  const statusOptions = ["all", "live", "unverified", "pending", "archived"];

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/listings" />
      <main className="flex-1 ml-64 p-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2137]">Listings Management</h1>
            <p className="text-[#3e4944] mt-1">{properties?.length ?? 0} listings</p>
          </div>
          <Link
            href="/admin/listings/new"
            className="bg-[#1a7a5e] text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add Listing
          </Link>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto">
          {statusOptions.map((s) => (
            <Link
              key={s}
              href={s === "all" ? "/admin/listings" : `/admin/listings?status=${s}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                (s === "all" && !status) || s === status
                  ? "bg-[#1a7a5e] text-white"
                  : "bg-white text-[#3e4944] border border-[#cccccc] hover:border-[#1a7a5e]"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f3f2] border-b border-[#bec9c2]">
                {["Property", "Area", "Price", "Status", "Added", "Actions"].map((h) => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bec9c2]">
              {(properties ?? []).map((p) => {
                const price = new Intl.NumberFormat("id-ID").format(p.price_monthly);
                const added = new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <tr key={p.id} className="hover:bg-[#f6f3f2] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#0d2137] text-sm">{p.name}</p>
                      <p className="text-xs text-[#3e4944] capitalize">{p.property_type}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#1b1c1c]">{p.area}</td>
                    <td className="px-6 py-4 text-sm font-medium text-[#1a7a5e]">IDR {price}</td>
                    <td className="px-6 py-4">
                      <StatusSelect propertyId={p.id} currentStatus={p.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-[#6e7a74]">{added}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/listings/${p.slug}`} target="_blank" className="text-[#6e7a74] hover:text-[#1a7a5e] text-xs">
                          View
                        </Link>
                        <Link href={`/admin/listings/${p.id}`} className="text-[#1a7a5e] text-sm font-medium hover:underline">
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(properties ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#6e7a74]">
                    No listings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
