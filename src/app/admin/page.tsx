import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/guards";
import { type Permission } from "@/lib/auth/permissions";
import { defaultLanding } from "@/lib/nav/server";
import { runIntegrityChecks } from "@/lib/ledger/integrity";
import { listPendingCreditRefunds } from "@/lib/actions/credit-actions";
import { countPendingOwnerRequests } from "@/lib/actions/owner-request-actions";
import { PendingCreditRefunds } from "./PendingCreditRefunds";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  // The dashboard is a set of widgets, each with its own permission. Holding
  // some staff role is not enough to see any of them: a surveyor used to see
  // listing prices, commissions, consultations and reviews here.
  const viewer = await getViewer();
  if (!viewer) redirect("/admin-login");
  const sees = (...ps: Permission[]) => ps.some((p) => viewer.permissions.includes(p));
  const canListingData = sees("listings.manage", "bookings.operate"); // listings, consultations, reviews
  const canBooks = sees("finance.view");                              // ledger integrity
  const canMoney = sees("finance.view", "finance.operate");           // credit refunds
  const canOwnerRequests = sees("listings.manage", "owners.payout_verify");
  const canCommission = sees("listings.manage", "finance.view");
  // Entitled to no widget at all: send them where they do have a page rather
  // than render an empty dashboard. (defaultLanding never returns /admin for
  // such a viewer: the menu offers the Dashboard only if a widget qualifies.)
  if (!canListingData && !canMoney && !canOwnerRequests && !canCommission) {
    redirect(await defaultLanding());
  }

  const integrity = canBooks
    ? await runIntegrityChecks(admin)
    : { allPassed: true, failedCount: 0, checks: [] } as Awaited<ReturnType<typeof runIntegrityChecks>>;
  const pendingCreditRefunds = canMoney ? await listPendingCreditRefunds() : [];
  const pendingOwnerRequests = canOwnerRequests ? await countPendingOwnerRequests() : 0;

  // Properties feed the commission warning too; consultations and reviews are
  // listing-side data and are not even read for anyone else.
  const needProperties = canListingData || canCommission;
  const [
    { data: properties },
    { data: consultations },
    { count: pendingReviews },
    { data: settings },
  ] = await Promise.all([
    needProperties
      ? admin.from("properties").select("id, name, area, property_type, status, price_monthly, created_at, rental_mode, platform_commission_pct").order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    canListingData
      ? admin.from("consultations").select("id, status, package_type, created_at").order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: null }),
    canListingData
      ? admin.from("reviews").select("id", { count: "exact", head: true }).eq("moderation_status", "pending")
      : Promise.resolve({ count: 0 }),
    canCommission
      ? admin.from("platform_settings").select("default_commission_pct").eq("id", 1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const defaultCommission =
    settings?.default_commission_pct == null ? null : Number(settings.default_commission_pct);

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

  // A short-stay property with no commission rate cannot have its booking
  // revenue split, so the whole amount lands in owner_payable and Cosystem
  // recognises nothing. Surfaced here because it is silent everywhere else.
  //
  // A property with no rate of its own now inherits the platform default, so
  // this only fires when there is no default either — otherwise it would warn
  // about every property that is working exactly as intended.
  const missingCommission = !canCommission || defaultCommission !== null ? [] : (properties ?? []).filter(
    (p) =>
      ["short_stay", "both"].includes((p as { rental_mode?: string }).rental_mode ?? "") &&
      (p as { platform_commission_pct?: number | null }).platform_commission_pct == null
  );

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AppSidebar activeHref="/admin" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-ink">Admin Dashboard</h1>
          <p className="text-ink-2 mt-1">Cosystem internal management panel</p>
        </header>

        {!integrity.allPassed && (
          <div className="mb-8 bg-[#cf2f52] text-white rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-2xl">error</span>
              <div className="flex-1">
                <p className="font-bold text-lg">
                  {integrity.failedCount} pemeriksaan buku besar gagal
                </p>
                <p className="text-white/90 text-sm mt-1">
                  Catatan keuangan tidak cocok dengan data transaksi. Angka pada laporan
                  tidak dapat dipercaya sampai ini diselesaikan.
                </p>
                <ul className="mt-4 space-y-3">
                  {integrity.checks.filter((c) => !c.passed).map((c) => (
                    <li key={c.id} className="bg-white/10 rounded-lg p-3">
                      <p className="font-semibold text-sm">{c.label}</p>
                      {c.difference !== null && (
                        <p className="text-xs text-white/80 mt-0.5 tabular-nums">
                          Buku besar {c.ledger?.toLocaleString("id-ID")} · seharusnya{" "}
                          {c.expected?.toLocaleString("id-ID")} · selisih{" "}
                          {c.difference.toLocaleString("id-ID")}
                        </p>
                      )}
                      {c.offenders.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {c.offenders.slice(0, 5).map((o) => (
                            <li key={o.id} className="text-xs text-white/85">
                              <strong>{o.label}</strong> — {o.detail}
                            </li>
                          ))}
                          {c.offenders.length > 5 && (
                            <li className="text-xs text-white/70">
                              dan {c.offenders.length - 5} lainnya
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <PendingCreditRefunds pending={pendingCreditRefunds} />

        {pendingOwnerRequests > 0 && (
          <Link
            href="/admin/owner-requests"
            className="block mb-10 bg-blue-50 border border-blue-200 rounded-xl p-5 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600">rule</span>
              <div>
                <p className="font-semibold text-blue-900">
                  {pendingOwnerRequests} permintaan pemilik menunggu persetujuan
                </p>
                <p className="text-sm text-blue-800 mt-1 max-w-2xl">
                  Perubahan tarif dan rekening pembayaran. Perubahan rekening wajib
                  dikonfirmasi lewat telepon sebelum disetujui.
                </p>
              </div>
            </div>
          </Link>
        )}

        {missingCommission.length > 0 && (
          <div className="mb-10 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500">warning</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {missingCommission.length} properti short-stay belum punya komisi platform
                </p>
                <p className="text-sm text-amber-800 mt-1 max-w-2xl">
                  Pemesanan pada properti ini tidak bisa dibagi otomatis. Seluruh sewa
                  akan tercatat sebagai hutang ke pemilik dan Cosystem tidak mencatat
                  pendapatan apa pun sampai komisi diisi.
                </p>
                <ul className="mt-3 space-y-1">
                  {missingCommission.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/admin/listings/${p.id}/build`}
                        className="text-sm font-semibold text-amber-900 hover:underline"
                      >
                        {p.name}
                        {p.area ? <span className="font-normal text-amber-800"> — {p.area}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
                {missingCommission.length > 6 && (
                  <p className="text-xs text-amber-800 mt-2">
                    dan {missingCommission.length - 6} lainnya
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {canListingData && (<>
        {/* Listing counts by status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {Object.entries(byStatus).map(([status, count]) => (
            <Link
              key={status}
              href={`/admin/listings?status=${status}`}
              className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm hover:border-brand transition-colors group"
            >
              <p className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1 capitalize group-hover:text-brand-ink">
                {status}
              </p>
              <p className="text-3xl font-bold text-ink">{count}</p>
              <p className="text-xs text-ink-3 mt-1">Listings</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { icon: "calendar_today", label: "Today's Consultations", value: todayConsultations, href: "/admin/consultations" },
            { icon: "rate_review", label: "Pending Reviews", value: pendingReviews ?? 0, href: "/admin" },
            { icon: "inbox", label: "New Submissions", value: byStatus.unverified, href: "/admin/listings?status=unverified" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="bg-white rounded-xl border border-[#cccccc] p-6 shadow-sm flex items-center gap-4 hover:border-brand transition-colors">
              <div className="w-12 h-12 bg-brand-soft rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-brand-ink">{stat.icon}</span>
              </div>
              <div>
                <p className="text-xs text-ink-2">{stat.label}</p>
                <p className="text-2xl font-bold text-ink">{stat.value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent unverified submissions */}
        <section className="bg-white rounded-xl border border-[#cccccc] shadow-sm">
          <div className="p-6 border-b border-line-strong flex justify-between items-center">
            <h3 className="text-lg font-semibold text-ink">Recent Owner Submissions</h3>
            <Link href="/admin/listings?status=unverified" className="text-brand-ink text-sm font-medium hover:underline">
              View All →
            </Link>
          </div>
          {recentSubmissions.length === 0 ? (
            <p className="p-6 text-sm text-ink-3">No pending submissions.</p>
          ) : (
            <div className="divide-y divide-line-strong">
              {recentSubmissions.map((p) => {
                const price = new Intl.NumberFormat("id-ID").format(p.price_monthly);
                return (
                  <div key={p.id} className="p-6 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink">{p.name}</p>
                      <p className="text-sm text-ink-2">{p.area} · {p.property_type} · IDR {price}/mo</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                        unverified
                      </span>
                      <Link href={`/admin/listings/${p.id}`} className="text-brand-ink text-sm font-medium hover:underline">
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </>)}
      </main>
    </div>
  );
}
