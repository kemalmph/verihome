import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { getSiteDashboard, type DashboardUnit, type DashboardInstalment } from "@/lib/actions/coworking-dashboard";
import { unitTypeLabel, paymentStatusLabel } from "@/lib/coworking/taxonomy";

export const dynamic = "force-dynamic";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

/**
 * Dates are rendered in Jakarta time, explicitly.
 *
 * Without the timeZone this formats in whatever zone the server runs in, which
 * is UTC — and a contract stored as 2027-01-01T00:00:00+07:00 then displayed
 * as "31 Des 2026", a day early, because 17:00 UTC the previous day is the
 * same instant. It did exactly that. The business is in Bandung; the only
 * correct zone to show an operator is theirs.
 */
const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
  });

export default async function SiteDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const d = await getSiteDashboard(id);
  if (!d) notFound();

  const { site, units, totals, instalments, ending_soon } = d;

  // Occupancy by area, not by unit count. Twelve empty cupboards and one let
  // hall is not "92% vacant" in any sense an operator cares about, and these
  // units are let by the square metre.
  const occPct = totals.sqm_total > 0 ? Math.round((totals.sqm_occupied / totals.sqm_total) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/coworking" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <nav className="text-sm text-[#6e7a74] mb-4">
          <Link href="/admin/coworking" className="hover:underline">Coworking</Link>
          <span className="mx-2">/</span>
          <Link href={`/admin/coworking/${site.id}`} className="hover:underline">{site.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-[#3e4944]">Dashboard</span>
        </nav>

        <header className="mb-8 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2137]">{site.name}</h1>
            {site.address && <p className="text-[#3e4944] mt-1">{site.address}</p>}
          </div>
          <Link
            href={`/admin/coworking/${site.id}`}
            className="px-4 py-2 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-white"
          >
            Kelola unit
          </Link>
        </header>

        {/* ── the numbers ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat
            label="Keterisian"
            value={`${occPct}%`}
            hint={`${totals.sqm_occupied.toFixed(1)} dari ${totals.sqm_total.toFixed(1)} m²`}
          />
          <Stat label="Terisi" value={`${totals.occupied} unit`} hint={`${totals.vacant} kosong`} />
          <Stat
            label="Tagihan belum dibayar"
            value={rupiah(instalments.outstanding_total)}
            hint={instalments.overdue.length > 0 ? `${instalments.overdue.length} lewat jatuh tempo` : "Tidak ada yang lewat tempo"}
            tone={instalments.overdue.length > 0 ? "alert" : undefined}
          />
          <Stat label="Sudah diterima" value={rupiah(instalments.paid_total)} hint="Total termin lunas" />
        </div>

        {/* ── what needs doing ────────────────────────────────────────── */}
        {(instalments.overdue.length > 0 || totals.unpriced > 0 || ending_soon.length > 0) && (
          <section className="mb-8 bg-white border border-[#ddd7d4] rounded-lg overflow-hidden">
            <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-[#0d2137]">Perlu tindakan</h2>
            <ul className="divide-y divide-[#e8e3e0]">
              {instalments.overdue.map((i) => (
                <Action key={i.id} tone="alert"
                  text={`${i.unit_name} · ${i.tenant} — termin ${i.seq} sebesar ${rupiah(i.amount)} lewat ${Math.abs(i.days_until_due)} hari (jatuh tempo ${tanggal(i.due_date)})`} />
              ))}
              {ending_soon.map((e) => (
                <Action key={e.reservation_id} tone={e.days_left <= 30 ? "alert" : "warn"}
                  text={`${e.unit_name} · ${e.tenant} — kontrak berakhir ${tanggal(e.ends_at)}, ${e.days_left} hari lagi`} />
              ))}
              {totals.unpriced > 0 && (
                <Action tone="warn"
                  text={`${totals.unpriced} unit belum punya harga. Unit tanpa harga tidak bisa ditawarkan atau disewakan.`} />
              )}
            </ul>
          </section>
        )}

        {/* ── units ───────────────────────────────────────────────────── */}
        <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-hidden mb-8">
          <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-[#0d2137]">
            Unit ({units.length})
          </h2>
          {units.length === 0 ? (
            <p className="p-8 text-center text-[#6e7a74] text-sm">Belum ada unit di site ini.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-[#e8e3e0]">
                  <Th>Unit</Th><Th>Tipe</Th><Th className="text-right">Luas</Th>
                  <Th className="text-right">Harga / tahun</Th><Th>Keadaan</Th><Th>Penyewa</Th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => <UnitRow key={u.id} u={u} />)}
              </tbody>
            </table>
          )}
        </section>

        {/* ── the schedule ────────────────────────────────────────────── */}
        <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-hidden">
          <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-[#0d2137]">Jadwal pembayaran</h2>
          {instalments.overdue.length + instalments.upcoming.length === 0 ? (
            <p className="p-8 text-center text-[#6e7a74] text-sm">Tidak ada tagihan terbuka.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-[#e8e3e0]">
                  <Th>Jatuh tempo</Th><Th>Unit</Th><Th>Penyewa</Th><Th>Termin</Th><Th className="text-right">Jumlah</Th>
                </tr>
              </thead>
              <tbody>
                {[...instalments.overdue, ...instalments.upcoming].map((i) => <InstalmentRow key={i.id} i={i} />)}
              </tbody>
            </table>
          )}
          <p className="px-5 py-3 text-xs text-[#6e7a74] border-t border-[#e8e3e0]">
            Jadwal ini mencatat apa yang terutang. Penandaan lunas di sini belum
            terhubung ke buku besar — pengakuan pendapatan tetap lewat fungsi
            settlement, supaya tidak terhitung dua kali.
          </p>
        </section>
      </main>
    </div>
  );
}

function UnitRow({ u }: { u: DashboardUnit }) {
  const occ = u.occupied_by;
  return (
    <tr className="border-b border-[#f0ecea] last:border-0 hover:bg-[#faf9f8]">
      <td className="px-4 py-3 font-medium text-[#0d2137]">{u.name}</td>
      <td className="px-4 py-3 text-[#3e4944]">{unitTypeLabel(u.unit_type)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-[#3e4944]">
        {u.size_sqm !== null ? `${u.size_sqm} m²` : "—"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {u.price !== null
          ? <span className="text-[#3e4944]">{rupiah(u.price)}</span>
          : <span className="text-[#8c3a2c]">belum ada harga</span>}
      </td>
      <td className="px-4 py-3">
        {u.status !== "available"
          ? <Pill tone="muted">{u.status === "maintenance" ? "Perbaikan" : "Tidak aktif"}</Pill>
          : occ
            ? <Pill tone="busy">Terisi s/d {tanggal(occ.ends_at)}</Pill>
            : u.next_up
              ? <Pill tone="warn">Mulai {tanggal(u.next_up.starts_at)}</Pill>
              : <Pill tone="free">Kosong</Pill>}
      </td>
      <td className="px-4 py-3 text-[#3e4944]">
        {occ ? (
          <>
            <div className="max-w-xs truncate" title={occ.tenant}>{occ.tenant}</div>
            <div className="text-xs text-[#6e7a74]">
              {occ.contract_ref ?? "tanpa no. kontrak"} · {paymentStatusLabel(occ.payment_status)}
            </div>
          </>
        ) : u.next_up ? (
          <div className="max-w-xs truncate text-[#6e7a74]" title={u.next_up.tenant}>{u.next_up.tenant}</div>
        ) : "—"}
      </td>
    </tr>
  );
}

function InstalmentRow({ i }: { i: DashboardInstalment }) {
  const late = i.days_until_due < 0;
  return (
    <tr className="border-b border-[#f0ecea] last:border-0">
      <td className="px-4 py-3">
        <span className={late ? "text-[#8c3a2c] font-medium" : "text-[#3e4944]"}>{tanggal(i.due_date)}</span>
        <div className="text-xs text-[#6e7a74]">
          {late ? `lewat ${Math.abs(i.days_until_due)} hari` : `${i.days_until_due} hari lagi`}
        </div>
      </td>
      <td className="px-4 py-3 text-[#3e4944]">{i.unit_name}</td>
      <td className="px-4 py-3 text-[#3e4944] max-w-xs truncate" title={i.tenant}>{i.tenant}</td>
      <td className="px-4 py-3 text-[#6e7a74]">{i.seq}</td>
      <td className="px-4 py-3 text-right tabular-nums text-[#0d2137] font-medium">{rupiah(i.amount)}</td>
    </tr>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6e7a74] ${className}`}>
      {children}
    </th>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "alert" }) {
  return (
    <div className={`bg-white border rounded-lg p-5 ${tone === "alert" ? "border-[#e2b3ab]" : "border-[#ddd7d4]"}`}>
      <div className="text-xs uppercase tracking-wide text-[#6e7a74]">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${tone === "alert" ? "text-[#8c3a2c]" : "text-[#0d2137]"}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-[#6e7a74] mt-1">{hint}</div>}
    </div>
  );
}

function Action({ text, tone }: { text: string; tone: "alert" | "warn" }) {
  return (
    <li className="px-5 py-3 flex items-start gap-3 text-sm">
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${tone === "alert" ? "bg-[#c2503c]" : "bg-[#d79a2b]"}`} />
      <span className="text-[#3e4944]">{text}</span>
    </li>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "free" | "busy" | "warn" | "muted" }) {
  const cls = {
    free:  "bg-[#e8f5f0] text-[#12614a] border-[#a9dcc8]",
    busy:  "bg-[#eef2fb] text-[#2d4a86] border-[#b6c6e8]",
    warn:  "bg-[#fdf4e3] text-[#8a6416] border-[#e6d09a]",
    muted: "bg-[#efeae8] text-[#6e7a74] border-[#ddd7d4]",
  }[tone];
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{children}</span>;
}
