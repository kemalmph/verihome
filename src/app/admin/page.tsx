import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const [
    { data: properties },
    { data: consultations },
    { count: pendingReviews },
  ] = await Promise.all([
    admin.from("properties").select("id, name, area, property_type, status, price_monthly, created_at").order("created_at", { ascending: false }),
    admin.from("consultations").select("id, status, package_type, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("moderation_status", "pending"),
  ]);

  const byStatus = {
    live: properties?.filter((p) => p.status === "live").length ?? 0,
    unverified: properties?.filter((p) => p.status === "unverified").length ?? 0,
    pending: properties?.filter((p) => p.status === "pending").length ?? 0,
    archived: properties?.filter((p) => p.status === "archived").length ?? 0,
  };

  const today = new Date().toDateString();
  const todayConsultations = consultations?.filter(
    (c) => new Date(c.created_at).toDateString() === today
  ).length ?? 0;

  const recentSubmissions = properties?.filter((p) => p.status === "unverified").slice(0, 5) ?? [];

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-[#0d2137]">Admin Dashboard</h1>
          <p className="text-[#3e4944] mt-1">VeriHome internal management panel</p>
        </header>

        {/* Listing counts by status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {Object.entries(byStatus).map(([status, count]) => (
            <Link
              key={status}
              href={`/admin/listings?status=${status}`}
              className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm hover:border-[#1a7a5e] transition-colors group"
            >
              <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-1 capitalize group-hover:text-[#1a7a5e]">
                {status}
              </p>
              <p className="text-3xl font-bold text-[#0d2137]">{count}</p>
              <p className="text-xs text-[#6e7a74] mt-1">Listings</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { icon: "calendar_today", label: "Today's Consultations", value: todayConsultations, href: "/admin/consultations" },
            { icon: "rate_review", label: "Pending Reviews", value: pendingReviews ?? 0, href: "/admin" },
            { icon: "inbox", label: "New Submissions", value: byStatus.unverified, href: "/admin/listings?status=unverified" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm flex items-center gap-4 hover:border-[#1a7a5e] transition-colors">
              <div className="w-12 h-12 bg-[#e8f5f0] rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[#1a7a5e]">{stat.icon}</span>
              </div>
              <div>
                <p className="text-xs text-[#3e4944]">{stat.label}</p>
                <p className="text-2xl font-bold text-[#0d2137]">{stat.value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent unverified submissions */}
        <section className="bg-white rounded-xl border border-[#cccccc] shadow-sm">
          <div className="p-6 border-b border-[#bec9c2] flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[#0d2137]">Recent Owner Submissions</h3>
            <Link href="/admin/listings?status=unverified" className="text-[#1a7a5e] text-sm font-medium hover:underline">
              View All →
            </Link>
          </div>
          {recentSubmissions.length === 0 ? (
            <p className="p-6 text-sm text-[#6e7a74]">No pending submissions.</p>
          ) : (
            <div className="divide-y divide-[#bec9c2]">
              {recentSubmissions.map((p) => {
                const price = new Intl.NumberFormat("id-ID").format(p.price_monthly);
                return (
                  <div key={p.id} className="p-6 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#0d2137]">{p.name}</p>
                      <p className="text-sm text-[#3e4944]">{p.area} · {p.property_type} · IDR {price}/mo</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                        unverified
                      </span>
                      <Link href={`/admin/listings/${p.id}`} className="text-[#1a7a5e] text-sm font-medium hover:underline">
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
