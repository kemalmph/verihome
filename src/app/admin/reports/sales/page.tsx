import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { resolvePeriod, PERIOD_OPTIONS } from "@/lib/reports/period";
import { getSalesReport, REVENUE_STREAMS } from "@/lib/reports/sales";
import { StreamBars, TrendLines, Legend } from "./Charts";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const pct = (n: number | null, digits = 1) => (n === null ? "—" : `${n.toFixed(digits)}%`);

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp.period, sp.from, sp.to);
  const r = await getSalesReport(period);

  const attention = [
    { label: "Pembayaran menunggu verifikasi", count: r.attention.awaitingVerification.count,
      amount: r.attention.awaitingVerification.amount, href: "/admin/bookings" },
    { label: "Hutang ke pemilik belum dibayar", count: null,
      amount: r.attention.ownerPayoutsDue.amount, href: "/admin/owners" },
    { label: "Refund diminta, belum dikonfirmasi", count: r.attention.refundsPending.count,
      amount: r.attention.refundsPending.amount, href: "/admin/viewings" },
    { label: "Properti short-stay tanpa komisi", count: r.attention.missingCommission.count,
      amount: null, href: "/admin/listings" },
    { label: "Penempatan belum ditagih", count: r.attention.placementsUninvoiced.count,
      amount: r.attention.placementsUninvoiced.amount, href: "/admin/placements" },
  ].filter((a) => (a.count ?? 0) > 0 || (a.amount ?? 0) > 0);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/reports/sales" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12 max-w-[1100px]">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-[#0d2137]">Laporan penjualan</h1>
          <p className="text-[#3e4944] mt-1">
            Semua angka berasal dari buku besar — {period.label.toLowerCase()}.
          </p>
        </header>

        {/* Period selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {PERIOD_OPTIONS.filter((o) => o.key !== "custom").map((o) => (
            <Link
              key={o.key}
              href={`/admin/reports/sales?period=${o.key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                period.key === o.key
                  ? "bg-white border-[#1a7a5e] text-[#1a7a5e] shadow-sm"
                  : "bg-white border-[#cccccc] text-[#3e4944] hover:border-[#1a7a5e]"
              }`}
            >
              {o.label}
            </Link>
          ))}
          <form action="/admin/reports/sales" className="flex items-center gap-2">
            <input type="hidden" name="period" value="custom" />
            <input type="date" name="from" defaultValue={sp.from}
              className="h-10 px-3 rounded-lg border border-[#cccccc] text-sm bg-white" />
            <span className="text-[#6e7a74] text-sm">–</span>
            <input type="date" name="to" defaultValue={sp.to}
              className="h-10 px-3 rounded-lg border border-[#cccccc] text-sm bg-white" />
            <button type="submit"
              className="h-10 px-4 rounded-lg border border-[#cccccc] bg-white text-sm font-medium text-[#3e4944] hover:border-[#1a7a5e]">
              Terapkan
            </button>
          </form>
        </div>

        {/* ── 1. Headline ─────────────────────────────────────────────────── */}
        {/* Net revenue is the primary figure and is styled as such; GBV is
            deliberately quieter so the two are never read as the same thing. */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          <div className="bg-[#0d2137] text-white rounded-xl p-6 md:row-span-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9cf4d1]">Pendapatan VeriHome</p>
            <p className="text-4xl font-bold mt-2 tabular-nums">IDR {fmt(r.netRevenue)}</p>
            <p className="text-sm text-white/60 mt-2">
              Yang benar-benar menjadi milik VeriHome pada periode ini
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#cccccc] p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6e7a74]">Nilai transaksi bruto</p>
            <p className="text-3xl font-semibold text-[#3e4944] mt-2 tabular-nums">IDR {fmt(r.gbv)}</p>
            <p className="text-sm text-[#6e7a74] mt-2">
              Total transaksi — <strong className="text-[#3e4944]">bukan pendapatan VeriHome</strong>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#cccccc] p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6e7a74]">Take rate</p>
            <p className="text-3xl font-semibold text-[#0d2137] mt-2 tabular-nums">{pct(r.takeRate)}</p>
            <p className="text-sm text-[#6e7a74] mt-2">Pendapatan dibagi nilai transaksi</p>
          </div>

          <div className="bg-white rounded-xl border border-[#cccccc] p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6e7a74]">Saldo kas</p>
            <p className="text-3xl font-semibold text-[#0d2137] mt-2 tabular-nums">IDR {fmt(r.cashPosition)}</p>
            <p className="text-sm text-[#6e7a74] mt-2">
              Termasuk dana milik pihak lain ·{" "}
              <Link href="/admin/reports/position" className="text-[#1a7a5e] font-semibold hover:underline">
                rincian
              </Link>
            </p>
          </div>
        </section>

        {/* ── 2. Revenue by stream ────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-6 mb-8">
          <h2 className="font-bold text-[#0d2137] mb-1">Pendapatan per sumber</h2>
          <p className="text-sm text-[#6e7a74] mb-5">Perbandingan dengan periode sebelumnya yang setara</p>

          <StreamBars data={r.streams} />

          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                  <th className="text-left py-2 font-medium">Sumber</th>
                  <th className="text-right py-2 font-medium">Jumlah</th>
                  <th className="text-right py-2 font-medium">Porsi</th>
                  <th className="text-right py-2 font-medium">Transaksi</th>
                  <th className="text-right py-2 font-medium">vs sebelumnya</th>
                </tr>
              </thead>
              <tbody>
                {r.streams.map((s) => (
                  <tr key={s.account} className="border-b border-[#f6f3f2]">
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-[#0d2137]">
                      {fmt(s.amount)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-[#6e7a74]">{pct(s.share, 0)}</td>
                    <td className="py-2.5 text-right tabular-nums text-[#6e7a74]">{s.count}</td>
                    <td className={`py-2.5 text-right tabular-nums ${
                      s.change === null ? "text-[#6e7a74]"
                        : s.change >= 0 ? "text-[#0d8f66]" : "text-[#cf2f52]"}`}>
                      {s.change === null ? "—" : `${s.change >= 0 ? "+" : ""}${s.change.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold text-[#0d2137]">
                  <td className="py-3">TOTAL PENDAPATAN</td>
                  <td className="py-3 text-right tabular-nums">{fmt(r.netRevenue)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 3. Trend ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-6 mb-8">
          <h2 className="font-bold text-[#0d2137] mb-1">Tren 12 bulan</h2>
          <p className="text-sm text-[#6e7a74] mb-4">Pendapatan bersih per bulan, dipisah per sumber</p>
          <Legend items={REVENUE_STREAMS.map((s) => ({ label: s.label, color: s.color }))} />
          <div className="mt-4">
            <TrendLines
              months={r.monthly.map((m) => m.month)}
              series={REVENUE_STREAMS.map((s) => ({
                label: s.label, color: s.color,
                values: r.monthly.map((m) => m.byAccount[s.account] ?? 0),
              }))}
            />
          </div>
        </section>

        {/* ── 4. Volume ────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <VolumeCard title="Pemesanan" rows={[
            ["Jumlah", String(r.volume.bookings.count)],
            ["Nilai transaksi", `IDR ${fmt(r.volume.bookings.gbv)}`],
            ["Rata-rata per pemesanan", `IDR ${fmt(r.volume.bookings.avgValue)}`],
            ["Rata-rata malam", r.volume.bookings.avgNights.toFixed(1)],
          ]} />
          <VolumeCard title="Kunjungan (viewing)" rows={[
            ["Diminta", String(r.volume.viewings.requested)],
            ["Hadir", String(r.volume.viewings.attended)],
            ["Tidak hadir", String(r.volume.viewings.noShow)],
            ["Tingkat kehadiran", pct(r.volume.viewings.rate, 0)],
          ]} />
          <VolumeCard title="Konsultasi" rows={
            r.volume.consultations.byPackage.length
              ? r.volume.consultations.byPackage.map((p) => [
                  `${p.package} (${p.count})`, `IDR ${fmt(p.revenue)}`,
                ] as [string, string])
              : [["Belum ada", "—"]]
          } />
          <VolumeCard title="Penempatan" rows={[
            ["Jumlah", String(r.volume.placements.count)],
            ["Total komisi", `IDR ${fmt(r.volume.placements.total)}`],
            ["Rata-rata komisi", `IDR ${fmt(r.volume.placements.avg)}`],
          ]} />
        </section>

        {/* ── 5. Top properties ────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-6 mb-8">
          <h2 className="font-bold text-[#0d2137] mb-1">Properti teratas</h2>
          <p className="text-sm text-[#6e7a74] mb-4">Diurutkan berdasarkan kontribusi pendapatan VeriHome</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 680 }}>
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                  <th className="text-left py-2 font-medium">Properti</th>
                  <th className="text-right py-2 font-medium">Pesanan</th>
                  <th className="text-right py-2 font-medium">Bruto</th>
                  <th className="text-right py-2 font-medium">Pendapatan</th>
                  <th className="text-right py-2 font-medium">Hak pemilik</th>
                  <th className="text-right py-2 font-medium">Malam</th>
                </tr>
              </thead>
              <tbody>
                {r.topProperties.map((p) => (
                  <tr key={p.id} className="border-b border-[#f6f3f2]">
                    <td className="py-2.5">
                      <Link href={`/admin/listings/${p.id}/build`} className="font-semibold text-[#0d2137] hover:text-[#1a7a5e]">
                        {p.name}
                      </Link>
                      {p.area && <span className="block text-xs text-[#6e7a74]">{p.area}</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{p.bookings}</td>
                    <td className="py-2.5 text-right tabular-nums text-[#6e7a74]">{fmt(p.gbv)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-[#0d8f66]">{fmt(p.revenue)}</td>
                    <td className="py-2.5 text-right tabular-nums text-[#3e4944]">{fmt(p.ownerPayout)}</td>
                    <td className="py-2.5 text-right tabular-nums text-[#6e7a74]">{p.nights}</td>
                  </tr>
                ))}
                {r.topProperties.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-[#6e7a74]">
                    Belum ada aktivitas pada periode ini.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 6. Needs attention ───────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-6">
          <h2 className="font-bold text-[#0d2137] mb-4">Perlu tindakan</h2>
          {attention.length === 0 ? (
            <p className="text-sm text-[#6e7a74]">Tidak ada yang tertunda.</p>
          ) : (
            <ul className="divide-y divide-[#f6f3f2]">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link href={a.href}
                    className="flex items-center justify-between gap-4 py-3 hover:text-[#1a7a5e] group">
                    <span className="text-sm text-[#3e4944] group-hover:text-[#1a7a5e]">{a.label}</span>
                    <span className="flex items-center gap-3 text-sm whitespace-nowrap">
                      {a.count !== null && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                          {a.count}
                        </span>
                      )}
                      {a.amount !== null && a.amount > 0 && (
                        <span className="font-semibold text-[#0d2137] tabular-nums">IDR {fmt(a.amount)}</span>
                      )}
                      <span className="material-symbols-outlined text-[#6e7a74] text-base">chevron_right</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function VolumeCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-5">
      <h3 className="font-semibold text-[#0d2137] mb-3">{title}</h3>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-[#f6f3f2] pb-2 last:border-0 last:pb-0">
            <dt className="text-[#6e7a74]">{k}</dt>
            <dd className="font-semibold text-[#0d2137] tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
