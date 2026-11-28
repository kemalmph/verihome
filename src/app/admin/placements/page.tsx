import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlacementForm, PlacementRow } from "./PlacementClient";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default async function PlacementsPage() {
  await requirePermissionOrRedirect(["finance.view", "finance.operate"]);
  const admin = createAdminClient();

  const [{ data: placements }, { data: properties }] = await Promise.all([
    admin
      .from("placements")
      .select("id, monthly_rent, commission_pct, commission_amount, status, lease_start_date, reported_by, created_at, property:properties(name, area)")
      .order("created_at", { ascending: false }),
    admin
      .from("properties")
      .select("id, name, area")
      .in("rental_mode", ["long_term", "both"])
      .order("name"),
  ]);

  const rows = placements ?? [];
  const outstanding = rows
    .filter((p) => ["reported", "invoiced"].includes(p.status ?? ""))
    .reduce((s, p) => s + Number(p.commission_amount ?? 0), 0);
  const collected = rows
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.commission_amount ?? 0), 0);

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref="/admin/placements" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12 max-w-[1100px]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ink">Penempatan jangka panjang</h1>
          <p className="text-ink-2 mt-1">
            Komisi dicatat saat penempatan dilaporkan — pekerjaan sudah selesai dan
            uangnya menjadi piutang, bukan menunggu pembayaran.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-line shadow-card p-5">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Belum dibayar</p>
            <p className="text-2xl font-bold text-ink mt-1 tabular-nums">IDR {fmt(outstanding)}</p>
            <p className="text-xs text-ink-3 mt-1">Piutang komisi</p>
          </div>
          <div className="bg-white rounded-2xl border border-line shadow-card p-5">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Sudah diterima</p>
            <p className="text-2xl font-bold text-brand-ink mt-1 tabular-nums">IDR {fmt(collected)}</p>
            <p className="text-xs text-ink-3 mt-1">Masuk ke kas</p>
          </div>
        </div>

        <PlacementForm properties={properties ?? []} />

        <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden mt-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 720 }}>
              <thead>
                <tr className="bg-canvas border-b border-line-strong text-xs uppercase tracking-wider text-ink-2">
                  <th className="text-left px-5 py-3 font-bold">Properti</th>
                  <th className="text-right px-5 py-3 font-bold">Sewa/bulan</th>
                  <th className="text-right px-5 py-3 font-bold">Komisi</th>
                  <th className="text-left px-5 py-3 font-bold">Mulai sewa</th>
                  <th className="text-left px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas">
                {rows.map((p) => (
                  <PlacementRow
                    key={p.id}
                    placement={{
                      id: p.id,
                      propertyName: (p.property as { name?: string } | null)?.name ?? "—",
                      area: (p.property as { area?: string } | null)?.area ?? null,
                      monthlyRent: Number(p.monthly_rent ?? 0),
                      commissionPct: Number(p.commission_pct ?? 0),
                      commissionAmount: Number(p.commission_amount ?? 0),
                      status: p.status ?? "reported",
                      leaseStart: p.lease_start_date,
                    }}
                  />
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-ink-3">
                      Belum ada penempatan tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
