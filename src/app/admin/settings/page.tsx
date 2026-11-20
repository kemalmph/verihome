import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings, countBookingsUnaffected } from "@/lib/actions/settings-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { CommissionSettingsForm } from "./CommissionSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // A route-group layout gates rendering, not data. This page reads platform
  // configuration, so it checks for itself.
  await requireAdmin();

  const admin = createAdminClient();
  const [settings, unaffected, { data: properties }] = await Promise.all([
    getPlatformSettings(),
    countBookingsUnaffected(),
    admin
      .from("properties")
      .select("id, name, area, rental_mode, status, platform_commission_pct")
      .in("rental_mode", ["short_stay", "both"])
      .order("name"),
  ]);

  const rows = (properties ?? []).map((p) => {
    const own = p.platform_commission_pct == null ? null : Number(p.platform_commission_pct);
    return {
      ...p,
      own,
      effective: own ?? settings.default_commission_pct,
      source: own !== null ? "own" : settings.default_commission_pct !== null ? "default" : "none",
    };
  });

  const inheriting = rows.filter((r) => r.source === "default").length;
  const unset      = rows.filter((r) => r.source === "none").length;

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/settings" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-[#0d2137]">Pengaturan</h1>
          <p className="text-[#3e4944] mt-1">Konfigurasi platform VeriHome</p>
        </header>

        <div className="max-w-4xl space-y-8">
          <CommissionSettingsForm
            initialPct={settings.default_commission_pct}
            updatedAt={settings.updated_at}
            updatedByName={settings.updated_by_name}
            unaffectedBookings={unaffected}
          />

          {/* Which properties the default actually governs. A rate with no
              visible consequences is how the old one stayed unset for months. */}
          <section className="bg-white rounded-xl border border-[#cccccc] shadow-sm">
            <div className="p-6 border-b border-[#e4e2e1]">
              <h2 className="text-lg font-semibold text-[#0d2137]">
                Properti sewa harian
              </h2>
              <p className="text-sm text-[#3e4944] mt-1">
                {rows.length === 0 ? (
                  "Belum ada properti sewa harian."
                ) : (
                  <>
                    {inheriting} memakai komisi bawaan
                    {unset > 0 && (
                      <span className="text-amber-700 font-medium">
                        {" "}· {unset} tanpa komisi sama sekali
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>

            {rows.length > 0 && (
              <div className="divide-y divide-[#f0eeed]">
                {rows.map((r) => (
                  <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/listings/${r.id}/build`}
                        className="font-medium text-[#0d2137] hover:text-[#1a7a5e] hover:underline"
                      >
                        {r.name}
                      </Link>
                      {r.area && <p className="text-xs text-[#6e7a74] mt-0.5">{r.area}</p>}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {r.source === "none" ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          belum diatur
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold text-[#0d2137] tabular-nums">
                            {r.effective}%
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              r.source === "own"
                                ? "bg-[#e8f5f0] text-[#1a7a5e]"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {r.source === "own" ? "komisi sendiri" : "bawaan"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
