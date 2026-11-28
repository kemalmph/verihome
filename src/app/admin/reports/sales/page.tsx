import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
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
  await requirePermissionOrRedirect(["finance.view"]);
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
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref="/admin/reports/sales" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12 max-w-[1100px]">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-ink">Laporan penjualan</h1>
          <p className="text-ink-2 mt-1">
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
                  ? "bg-white border-brand text-brand-ink shadow-sm"
                  : "bg-white border-line-strong text-ink-2 hover:border-brand"
              }`}
            >
              {o.label}
            </Link>
          ))}
          <form action="/admin/reports/sales" className="flex items-center gap-2">
            <input type="hidden" name="period" value="custom" />
            <input type="date" name="from" defaultValue={sp.from}
              className="h-10 px-3 rounded-lg border border-line-strong text-sm bg-white" />
            <span className="text-ink-3 text-sm">–</span>
            <input type="date" name="to" defaultValue={sp.to}
              className="h-10 px-3 rounded-lg border border-line-strong text-sm bg-white" />
            <button type="submit"
              className="h-10 px-4 rounded-lg border border-line-strong bg-white text-sm font-medium text-ink-2 hover:border-brand">
              Terapkan
            </button>
          </form>
        </div>

        {/* ── 1. Headline ─────────────────────────────────────────────────── */}
        {/* Net revenue is the primary figure and is styled as such; GBV is
            deliberately quieter so the two are never read as the same thing. */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          <div className="bg-ink text-white rounded-xl p-6 md:row-span-1">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Pendapatan Cosystem</p>
            <p className="text-4xl font-bold mt-2 tabular-nums">IDR {fmt(r.netRevenue)}</p>
            <p className="text-sm text-white/60 mt-2">
              Yang benar-benar menjadi milik Cosystem pada periode ini
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-line shadow-card p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Nilai transaksi bruto</p>
            <p className="text-3xl font-semibold text-ink-2 mt-2 tabular-nums">IDR {fmt(r.gbv)}</p>
            <p className="text-sm text-ink-3 mt-2">
              Total transaksi — <strong className="text-ink-2">bukan pendapatan Cosystem</strong>
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-line shadow-card p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Take rate</p>
            <p className="text-3xl font-semibold text-ink mt-2 tabular-nums">{pct(r.takeRate)}</p>
            <p className="text-sm text-ink-3 mt-2">Pendapatan dibagi nilai transaksi</p>
          </div>

          <div className="bg-white rounded-2xl border border-line shadow-card p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Saldo kas</p>
            <p className="text-3xl font-semibold text-ink mt-2 tabular-nums">IDR {fmt(r.cashPosition)}</p>
            <p className="text-sm text-ink-3 mt-2">
              Termasuk dana milik pihak lain ·{" "}
              <Link href="/admin/reports/position" className="text-brand-ink font-semibold hover:underline">
                rincian
              </Link>
            </p>
          </div>
        </section>

        {/* ── 2. Revenue by stream ────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-line shadow-card p-6 mb-8">
          <h2 className="font-bold text-ink mb-1">Pendapatan per sumber</h2>
          <p className="text-sm text-ink-3 mb-5">Perbandingan dengan periode sebelumnya yang setara</p>

          <StreamBars data={r.streams} />

          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="text-xs uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="text-left py-2 font-medium">Sumber</th>
                  <th className="text-right py-2 font-medium">Jumlah</th>
                  <th className="text-right py-2 font-medium">Porsi</th>
                  <th className="text-right py-2 font-medium">Transaksi</th>
                  <th className="text-right py-2 font-medium">vs sebelumnya</th>
                </tr>
              </thead>
              <tbody>
                {r.streams.map((s) => (
                  <tr key={s.account} className="border-b border-canvas">
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-ink">
                      {fmt(s.amount)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-3">{pct(s.share, 0)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-3">{s.count}</td>
                    <td className={`py-2.5 text-right tabular-nums ${
                      s.change === null ? "text-ink-3"
                        : s.change >= 0 ? "text-success" : "text-[#cf2f52]"}`}>
                      {s.change === null ? "—" : `${s.change >= 0 ? "+" : ""}${s.change.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold text-ink">
                  <td className="py-3">TOTAL PENDAPATAN</td>
                  <td className="py-3 text-right tabular-nums">{fmt(r.netRevenue)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 3. Trend ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-line shadow-card p-6 mb-8">
          <h2 className="font-bold text-ink mb-1">Tren 12 bulan</h2>
          <p className="text-sm text-ink-3 mb-4">Pendapatan bersih per bulan, dipisah per sumber</p>
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
        <section className="bg-white rounded-2xl border border-line shadow-card p-6 mb-8">
          <h2 className="font-bold text-ink mb-1">Properti teratas</h2>
          <p className="text-sm text-ink-3 mb-4">Diurutkan berdasarkan kontribusi pendapatan Cosystem</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 680 }}>
              <thead>
                <tr className="text-xs uppercase tracking-wider text-ink-3 border-b border-line">
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
                  <tr key={p.id} className="border-b border-canvas">
                    <td className="py-2.5">
                      <Link href={`/admin/listings/${p.id}/build`} className="font-semibold text-ink hover:text-brand-ink">
                        {p.name}
                      </Link>
                      {p.area && <span className="block text-xs text-ink-3">{p.area}</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{p.bookings}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-3">{fmt(p.gbv)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-success">{fmt(p.revenue)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-2">{fmt(p.ownerPayout)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-3">{p.nights}</td>
                  </tr>
                ))}
                {r.topProperties.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-ink-3">
                    Belum ada aktivitas pada periode ini.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Exports ───────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-line shadow-card p-6 mb-8">
          <h2 className="font-bold text-ink mb-1">Ekspor untuk akuntan</h2>
          <p className="text-sm text-ink-3 mb-4">
            CSV dengan angka polos tanpa pemisah ribuan, siap dibuka di spreadsheet.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { type: "ledger",           label: "Buku besar lengkap" },
              { type: "revenue_by_month", label: "Pendapatan per bulan" },
              { type: "owner_payable",    label: "Hutang pemilik" },
              { type: "transactions",     label: "Semua transaksi" },
            ].map((e) => (
              <a
                key={e.type}
                href={`/api/admin/reports/export?type=${e.type}&from=${period.from.toISOString()}&to=${period.to.toISOString()}`}
                className="px-4 py-2 border border-line-strong rounded-lg text-sm font-medium text-ink-2 hover:border-brand inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">table_view</span>
                {e.label}
              </a>
            ))}
          </div>
        </section>

        {/* ── 6. Needs attention ───────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-line shadow-card p-6">
          <h2 className="font-bold text-ink mb-4">Perlu tindakan</h2>
          {attention.length === 0 ? (
            <p className="text-sm text-ink-3">Tidak ada yang tertunda.</p>
          ) : (
            <ul className="divide-y divide-canvas">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link href={a.href}
                    className="flex items-center justify-between gap-4 py-3 hover:text-brand-ink group">
                    <span className="text-sm text-ink-2 group-hover:text-brand-ink">{a.label}</span>
                    <span className="flex items-center gap-3 text-sm whitespace-nowrap">
                      {a.count !== null && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                          {a.count}
                        </span>
                      )}
                      {a.amount !== null && a.amount > 0 && (
                        <span className="font-semibold text-ink tabular-nums">IDR {fmt(a.amount)}</span>
                      )}
                      <span className="material-symbols-outlined text-ink-3 text-base">chevron_right</span>
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
    <div className="bg-white rounded-2xl border border-line shadow-card p-5">
      <h3 className="font-semibold text-ink mb-3">{title}</h3>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-canvas pb-2 last:border-0 last:pb-0">
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-semibold text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
