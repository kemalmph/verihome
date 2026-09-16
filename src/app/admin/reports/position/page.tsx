import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLedgerBalances, balanceOf } from "@/lib/ledger/post";
import { Reconcile } from "./Reconcile";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

export default async function PositionPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string }>;
}) {
  const sp = await searchParams;

  const today = new Date().toISOString().slice(0, 10);
  const asOfDate = sp.as_of && /^\d{4}-\d{2}-\d{2}$/.test(sp.as_of) ? sp.as_of : today;
  // Exclusive upper bound: balances "as of" a date include everything on it.
  const asOfExclusive = new Date(`${asOfDate}T00:00:00Z`);
  asOfExclusive.setUTCDate(asOfExclusive.getUTCDate() + 1);

  const admin = createAdminClient();
  const balances = await getLedgerBalances({ to: asOfExclusive, client: admin });

  const cash        = balanceOf(balances, "cash");
  const receivable  = balanceOf(balances, "commission_receivable");
  const deposits    = balanceOf(balances, "deposits_held");
  const credits     = balanceOf(balances, "credits_outstanding");
  const unearned    = balanceOf(balances, "unearned_revenue");
  const ownerOwed   = balanceOf(balances, "owner_payable");

  const totalAssets      = cash + receivable;
  const totalLiabilities = deposits + credits + unearned + ownerOwed;
  const netPosition      = totalAssets - totalLiabilities;

  // Spendable cash. Deliberately excludes commission_receivable: money owed to
  // VeriHome is not money VeriHome can spend.
  const ownFunds = cash - totalLiabilities;
  const overdrawn = ownFunds < 0;

  const share = (v: number) => (cash > 0 ? Math.max(0, Math.min(100, (v / cash) * 100)) : 0);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/reports/position" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12 max-w-[900px]">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-[#0d2137]">Posisi keuangan</h1>
          <p className="text-[#3e4944] mt-1">
            Dari uang yang kami pegang, berapa yang benar-benar milik VeriHome?
          </p>
        </header>

        <form action="/admin/reports/position" className="flex items-end gap-2 mb-8">
          <div>
            <label htmlFor="as_of" className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1">
              Per tanggal
            </label>
            <input id="as_of" name="as_of" type="date" defaultValue={asOfDate} max={today}
              className="h-10 px-3 rounded-lg border border-[#cccccc] text-sm bg-white" />
          </div>
          <button type="submit"
            className="h-10 px-4 rounded-lg border border-[#cccccc] bg-white text-sm font-medium text-[#3e4944] hover:border-[#1a7a5e]">
            Tampilkan
          </button>
        </form>

        {/* ── The statement ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-[#cccccc] overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-[#e4e2e1]">
            <h2 className="font-bold text-[#0d2137]">Laporan posisi keuangan</h2>
            <p className="text-xs text-[#6e7a74] mt-0.5">Per {asOfDate}</p>
          </div>

          <div className="px-6 py-5">
            <SectionLabel>ASET</SectionLabel>
            <Line label="Kas dan bank" value={cash} />
            <Line label="Piutang komisi" value={receivable} />
            <Total label="TOTAL ASET" value={totalAssets} />
          </div>

          <div className="px-6 py-5 border-t border-[#e4e2e1]">
            <SectionLabel>KEWAJIBAN — uang milik pihak lain</SectionLabel>

            <p className="text-xs text-[#6e7a74] mt-3 mb-1">Akan dikembalikan kepada pembayar:</p>
            <Line label="Titipan jaminan" value={deposits} indent />
            <Line label="Kredit pengguna" value={credits} indent />

            <p className="text-xs text-[#6e7a74] mt-4 mb-1">Akan menjadi pendapatan VeriHome:</p>
            <Line label="Pendapatan diterima di muka" value={unearned} indent />

            <p className="text-xs text-[#6e7a74] mt-4 mb-1">Terhutang kepada pihak ketiga:</p>
            <Line label="Hutang pemilik properti" value={ownerOwed} indent />

            <Total label="TOTAL KEWAJIBAN" value={totalLiabilities} />
          </div>

          <div className={`px-6 py-5 border-t-2 ${netPosition < 0 ? "border-[#cf2f52] bg-red-50" : "border-[#0d2137]"}`}>
            <div className="flex justify-between items-baseline gap-4">
              <div>
                <p className="font-bold text-[#0d2137]">POSISI BERSIH</p>
                <p className="text-xs text-[#6e7a74] mt-0.5">Total aset dikurangi total kewajiban</p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${netPosition < 0 ? "text-[#cf2f52]" : "text-[#0d2137]"}`}>
                IDR {fmt(netPosition)}
              </p>
            </div>
          </div>
        </section>

        {/* ── Cash breakdown ───────────────────────────────────────────────── */}
        <section className={`rounded-xl border p-6 mb-8 ${
          overdrawn ? "bg-red-50 border-[#cf2f52]" : "bg-white border-[#cccccc]"
        }`}>
          <h2 className="font-bold text-[#0d2137]">Rincian kas</h2>
          <p className="text-sm text-[#6e7a74] mt-1 mb-5">
            Dari IDR {fmt(cash)} yang dipegang saat ini:
          </p>

          <div className="space-y-3">
            <Slice label="Milik pemilik properti" value={ownerOwed} share={share(ownerOwed)} color="#c27c00" />
            <Slice label="Jaminan dan kredit yang dapat dikembalikan" value={deposits + credits} share={share(deposits + credits)} color="#1f6fd0" />
            <Slice label="Pendapatan diterima di muka — layanan belum diberikan" value={unearned} share={share(unearned)} color="#7d3cc0" />

            <div className={`pt-4 mt-4 border-t-2 ${overdrawn ? "border-[#cf2f52]" : "border-[#0d2137]"}`}>
              <div className="flex justify-between items-baseline gap-4">
                <div>
                  <p className="font-bold text-[#0d2137]">Dana milik VeriHome</p>
                  <p className="text-xs text-[#6e7a74] mt-0.5">
                    Satu-satunya jumlah yang boleh dibelanjakan
                  </p>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${overdrawn ? "text-[#cf2f52]" : "text-[#0d8f66]"}`}>
                  IDR {fmt(ownFunds)}
                </p>
              </div>
            </div>
          </div>

          {overdrawn && (
            <div className="mt-5 bg-[#cf2f52] text-white rounded-lg p-5">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white text-2xl">error</span>
                <div>
                  <p className="font-bold text-lg leading-snug">
                    Kas yang tersedia lebih kecil dari kewajiban.
                    Dana milik pihak lain telah terpakai.
                  </p>
                  <p className="text-white/90 text-sm mt-2">
                    Kekurangan sebesar <strong>IDR {fmt(Math.abs(ownFunds))}</strong>. Uang jaminan,
                    kredit pengguna, atau hak pemilik properti sedang dipakai untuk hal lain.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!overdrawn && receivable > 0 && (
            <p className="text-xs text-[#6e7a74] mt-4">
              Piutang komisi IDR {fmt(receivable)} tidak termasuk di atas — sudah menjadi
              pendapatan, tetapi belum berupa kas sehingga belum dapat dibelanjakan.
            </p>
          )}
        </section>

        <Reconcile ledgerCash={cash} />

        <p className="text-xs text-[#6e7a74] mt-6">
          Setiap angka berasal dari buku besar.{" "}
          <Link href="/admin/reports/sales" className="text-[#1a7a5e] font-semibold hover:underline">
            Laporan penjualan
          </Link>
        </p>
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-wider text-[#3e4944]">{children}</p>;
}

function Line({ label, value, indent }: { label: string; value: number; indent?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 text-sm ${indent ? "pl-4" : ""}`}>
      <span className="text-[#3e4944]">{label}</span>
      <span className="tabular-nums text-[#0d2137]">{fmt(value)}</span>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 pt-3 mt-2 border-t border-[#cccccc] text-sm font-bold">
      <span className="text-[#0d2137]">{label}</span>
      <span className="tabular-nums text-[#0d2137]">IDR {fmt(value)}</span>
    </div>
  );
}

function Slice({ label, value, share, color }: {
  label: string; value: number; share: number; color: string;
}) {
  return (
    <div>
      <div className="flex justify-between gap-4 text-sm mb-1">
        <span className="text-[#3e4944] flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
          {label}
        </span>
        <span className="tabular-nums font-semibold text-[#0d2137] whitespace-nowrap">
          IDR {fmt(value)}
        </span>
      </div>
      <div className="h-2 bg-[#e4e2e1] rounded-full overflow-hidden ml-5">
        <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
      </div>
    </div>
  );
}
