import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { listSites, listOwnerOptions } from "@/lib/actions/coworking-actions";
import { siteStatusLabel, siteTypeLabel } from "@/lib/coworking/taxonomy";
import { NewSiteForm } from "./NewSiteForm";

export const dynamic = "force-dynamic";

export default async function CoworkingSitesPage() {
  await requirePermissionOrRedirect(["sites.operate_all", "sites.finance_all"]);
  // The layout gates rendering, not data. This page reads sites, so it checks.

  const [sites, owners] = await Promise.all([listSites(), listOwnerOptions()]);

  const totalUnits = sites.reduce((n, s) => n + s.unit_count, 0);
  const totalSeats = sites.reduce((n, s) => n + s.capacity, 0);

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref="/site" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-ink">Site</h1>
          <p className="text-ink-2 mt-1">
            Gedung dan unit yang disewakan di dalamnya
          </p>
        </header>

        {sites.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Stat label="Site" value={String(sites.length)} />
            <Stat label="Unit" value={String(totalUnits)} />
            <Stat
              label="Kapasitas tersedia"
              value={String(totalSeats)}
              hint="Hanya unit berstatus tersedia"
            />
          </div>
        )}

        <section className="bg-white border border-line rounded-2xl shadow-card overflow-hidden mb-10">
          {sites.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-ink font-semibold">Belum ada site</p>
              <p className="text-ink-3 text-sm mt-1 max-w-md mx-auto">
                Sebuah site adalah gedungnya. Ia tidak punya harga dan tidak bisa
                dipesan — yang menghasilkan adalah unit di dalamnya.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#efeae8] text-left">
                <tr>
                  <Th>Nama</Th>
                  <Th>Tipe</Th>
                  <Th>Area</Th>
                  <Th>Pemilik</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Unit</Th>
                  <Th className="text-right">Kapasitas</Th>
                  <Th>Jam</Th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-t border-[#e8e3e0] hover:bg-[#faf9f8]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/site/${s.slug}`}
                        className="font-medium text-brand-ink hover:underline"
                      >
                        {s.name}
                      </Link>
                      {s.address && (
                        <div className="text-xs text-ink-3 mt-0.5">{s.address}</div>
                      )}
                      <Link
                        href={`/site/${s.slug}/dashboard`}
                        className="text-xs text-ink-3 hover:text-brand-ink hover:underline"
                      >
                        Dashboard operator →
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{siteTypeLabel(s.site_type)}</td>
                    <td className="px-4 py-3 text-ink-2">{s.area ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-2">{s.owner_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                      {s.unit_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                      {s.capacity}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {s.opening_time && s.closing_time
                        ? `${s.opening_time.slice(0, 5)}–${s.closing_time.slice(0, 5)}`
                        : "24 jam"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <NewSiteForm owners={owners} />
      </main>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3 ${className}`}>
      {children}
    </th>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-ink-3">{label}</div>
      <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-ink-3 mt-1">{hint}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active" ? "bg-success-soft text-success-ink border-success-line"
    : status === "closed" ? "bg-[#fbeeec] text-[#8c3a2c] border-[#e2b3ab]"
    : "bg-[#efeae8] text-ink-3 border-line-strong";
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${tone}`}>
      {siteStatusLabel(status)}
    </span>
  );
}
