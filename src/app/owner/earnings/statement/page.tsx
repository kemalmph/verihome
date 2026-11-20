import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getOwnerStatement } from "@/lib/reports/owner-statement";
import { PrintButton } from "@/components/print/PrintButton";
import { PRINT_CSS } from "@/components/print/print.css";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

/**
 * The same generator the admin statement uses, but the owner id comes from
 * requireOwner() and the URL is ignored entirely. There is no id to tamper
 * with, because there is no id in the request.
 */
export default async function OwnerOwnStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }

  const sp = await searchParams;
  const months = [3, 6, 12].includes(Number(sp.months)) ? Number(sp.months) : 6;
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - months + 1, 1));

  const s = await getOwnerStatement(owner.ownerId, from, to);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <main className="min-h-screen bg-[#f6f3f2] px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
            <Link href="/owner/earnings" className="text-sm text-[#1a7a5e] font-semibold hover:underline inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Pendapatan
            </Link>
            <div className="flex gap-2">
              {[3, 6, 12].map((m) => (
                <Link key={m} href={`/owner/earnings/statement?months=${m}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    months === m ? "bg-white border-[#1a7a5e] text-[#1a7a5e]"
                                 : "bg-white border-[#cccccc] text-[#3e4944] hover:border-[#1a7a5e]"}`}>
                  {m} bln
                </Link>
              ))}
              <PrintButton label="Unduh PDF" />
            </div>
          </div>

          <article className="print-sheet bg-white rounded-xl border border-[#cccccc] p-8 md:p-10">
            <div className="flex justify-between items-start gap-6 pb-6 border-b-2 border-[#0d2137]">
              <div>
                <p className="text-2xl font-extrabold text-[#0d2137] tracking-tight">VeriHome</p>
                <p className="text-xs text-[#6e7a74] mt-1">Laporan pemilik properti / Owner statement</p>
              </div>
              <div className="text-right text-xs text-[#3e4944]">
                <p className="font-semibold text-[#0d2137]">{s.owner?.name}</p>
                <p>{s.owner?.email ?? ""}</p>
                <p className="mt-1">
                  {from.toLocaleDateString("id-ID", { month: "short", year: "numeric" })} –{" "}
                  {to.toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 py-6 border-b border-[#e4e2e1]">
              <div>
                <p className="text-xs text-[#6e7a74]">Diperoleh</p>
                <p className="text-lg font-bold text-[#0d2137] tabular-nums">Rp {fmt(s.earned)}</p>
              </div>
              <div>
                <p className="text-xs text-[#6e7a74]">Dibayarkan</p>
                <p className="text-lg font-bold text-[#0d2137] tabular-nums">Rp {fmt(s.paidOut)}</p>
              </div>
              <div>
                <p className="text-xs text-[#6e7a74]">Belum dibayarkan</p>
                <p className="text-lg font-bold text-[#1a7a5e] tabular-nums">Rp {fmt(s.outstanding)}</p>
              </div>
            </div>

            {s.detail.length > 0 && (
              <div className="py-6">
                <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">Rincian menginap</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 520 }}>
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                        <th className="text-left py-2 font-medium">Pemesanan</th>
                        <th className="text-right py-2 font-medium">Bruto</th>
                        <th className="text-right py-2 font-medium">Komisi</th>
                        <th className="text-right py-2 font-medium">Untuk Anda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.detail.map((d) => (
                        <tr key={d.code} className="border-b border-[#f0eeed] last:border-0">
                          <td className="py-2.5">
                            <span className="block text-[#0d2137]">{d.property}</span>
                            <span className="block text-xs text-[#6e7a74]">
                              {d.code} · {d.checkIn} → {d.checkOut} · {d.nights} malam · {d.guest}
                            </span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{fmt(d.gross)}</td>
                          <td className="py-2.5 text-right tabular-nums">{fmt(d.commission)}</td>
                          <td className="py-2.5 text-right font-semibold tabular-nums">{fmt(d.ownerShare)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {s.payouts.length > 0 && (
              <div className="py-6 border-t border-[#e4e2e1]">
                <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">Pembayaran</p>
                {s.payouts.map((p, i) => (
                  <div key={i} className="flex justify-between py-1.5 text-sm">
                    <span className="text-[#3e4944]">{p.date} · {p.description}</span>
                    <span className="tabular-nums">Rp {fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-[#6e7a74] pt-6 border-t border-[#e4e2e1]">
              Seluruh angka diambil dari buku besar VeriHome. Jumlah dalam IDR.
            </p>
          </article>
        </div>
      </main>
    </>
  );
}
