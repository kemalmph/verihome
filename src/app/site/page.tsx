import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { listSites, listOwnerOptions } from "@/lib/actions/coworking-actions";
import { siteStatusLabel, siteTypeLabel } from "@/lib/coworking/taxonomy";
import { NewSiteForm } from "./NewSiteForm";

export const dynamic = "force-dynamic";

export default async function CoworkingSitesPage() {
  // The layout gates rendering, not data. This page reads sites, so it checks.
  await requireAdmin();

  const [sites, owners] = await Promise.all([listSites(), listOwnerOptions()]);

  const totalUnits = sites.reduce((n, s) => n + s.unit_count, 0);
  const totalSeats = sites.reduce((n, s) => n + s.capacity, 0);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/site" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">Site</h1>
          <p className="text-[#3e4944] mt-1">
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

        <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-hidden mb-10">
          {sites.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-[#0d2137] font-semibold">Belum ada site</p>
              <p className="text-[#6e7a74] text-sm mt-1 max-w-md mx-auto">
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
                        className="font-medium text-[#1a7a5e] hover:underline"
                      >
                        {s.name}
                      </Link>
                      {s.address && (
                        <div className="text-xs text-[#6e7a74] mt-0.5">{s.address}</div>
                      )}
                      <Link
                        href={`/site/${s.slug}/dashboard`}
                        className="text-xs text-[#6e7a74] hover:text-[#1a7a5e] hover:underline"
                      >
                        Dashboard operator →
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#3e4944]">{siteTypeLabel(s.site_type)}</td>
                    <td className="px-4 py-3 text-[#3e4944]">{s.area ?? "—"}</td>
                    <td className="px-4 py-3 text-[#3e4944]">{s.owner_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3e4944]">
                      {s.unit_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#3e4944]">
                      {s.capacity}
                    </td>
                    <td className="px-4 py-3 text-[#3e4944]">
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
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6e7a74] ${className}`}>
      {children}
    </th>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-[#ddd7d4] rounded-lg p-5">
      <div className="text-xs uppercase tracking-wide text-[#6e7a74]">{label}</div>
      <div className="text-2xl font-bold text-[#0d2137] mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-[#6e7a74] mt-1">{hint}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active" ? "bg-[#e8f5f0] text-[#12614a] border-[#a9dcc8]"
    : status === "closed" ? "bg-[#fbeeec] text-[#8c3a2c] border-[#e2b3ab]"
    : "bg-[#efeae8] text-[#6e7a74] border-[#ddd7d4]";
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${tone}`}>
      {siteStatusLabel(status)}
    </span>
  );
}
