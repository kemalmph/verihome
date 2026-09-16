import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getAccountStatement } from "@/lib/reports/statement";
import { PrintButton } from "@/components/print/PrintButton";
import { PRINT_CSS } from "@/components/print/print.css";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/dashboard/statement");

  const months = [3, 6, 12, 24].includes(Number(sp.months)) ? Number(sp.months) : 6;
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - months + 1, 1));

  const s = await getAccountStatement(user.id, from, to);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <main className="min-h-screen bg-[#f6f3f2] px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
            <div className="flex gap-2">
              {[3, 6, 12, 24].map((m) => (
                <Link key={m} href={`/dashboard/statement?months=${m}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    months === m ? "bg-white border-[#1a7a5e] text-[#1a7a5e]"
                                 : "bg-white border-[#cccccc] text-[#3e4944] hover:border-[#1a7a5e]"}`}>
                  {m} bulan
                </Link>
              ))}
            </div>
            <div className="flex gap-2">
              <a href={`/api/admin/reports/export?type=my_statement&months=${months}`}
                 className="px-4 py-2.5 border border-[#cccccc] bg-white rounded-lg font-semibold text-sm text-[#3e4944] hover:border-[#1a7a5e] inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-base">table_view</span> CSV
              </a>
              <PrintButton />
            </div>
          </div>

          <article className="print-sheet bg-white rounded-xl border border-[#cccccc] p-8 md:p-10">
            <div className="flex justify-between items-start gap-6 pb-6 border-b-2 border-[#0d2137]">
              <div>
                <p className="text-2xl font-extrabold text-[#0d2137] tracking-tight">VeriHome</p>
                <p className="text-xs text-[#6e7a74] mt-1">Rekening koran / Account statement</p>
              </div>
              <div className="text-right text-xs text-[#6e7a74]">
                <p className="font-semibold text-[#0d2137]">{user.name ?? user.email}</p>
                <p>{user.email}</p>
                <p className="mt-1">
                  {from.toISOString().slice(0, 10)} – {to.toISOString().slice(0, 10)}
                </p>
              </div>
            </div>

            {/* Summary — deposits and credits read as the guest's money, not ours */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 border-b border-[#e4e2e1]">
              <Summary label="Total dibayar" labelEn="Total spent" value={s.totalSpent} />
              <Summary label="Jaminan ditahan VeriHome" labelEn="Deposits held — refundable"
                       value={s.depositsHeld} tone="held" />
              <Summary label="Saldo kredit" labelEn="Available credit"
                       value={s.creditBalance} tone="credit" />
            </section>

            {s.expiringSoon.length > 0 && (
              <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 avoid-break">
                <p className="text-sm font-semibold text-amber-900">
                  Kredit yang segera kedaluwarsa <span className="font-normal">/ Expiring within 60 days</span>
                </p>
                <ul className="mt-2 space-y-1">
                  {s.expiringSoon.map((c, i) => (
                    <li key={i} className="flex justify-between text-sm text-amber-900">
                      <span>Kedaluwarsa {c.expiresAt}</span>
                      <span className="font-semibold tabular-nums">IDR {fmt(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(s.depositsHeld > 0 || s.creditBalance > 0) && (
              <p className="mt-5 text-xs text-[#3e4944] bg-[#e8f5f0] border border-[#9cf4d1] rounded-lg px-4 py-3">
                Jaminan dan kredit di atas adalah <strong>milik Anda</strong>. VeriHome hanya
                menyimpannya — jaminan dikembalikan sesuai ketentuan, dan kredit dapat dipakai
                untuk pemesanan berikutnya.
                <span className="block mt-1 text-[#6e7a74]">
                  Deposits and credit shown above belong to you. VeriHome only holds them.
                </span>
              </p>
            )}

            {/* History */}
            <section className="mt-8">
              <h2 className="font-bold text-[#0d2137] mb-3">
                Riwayat transaksi <span className="font-normal text-sm text-[#6e7a74]">/ Transaction history</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 520 }}>
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                      <th className="text-left py-2 font-medium">Tanggal</th>
                      <th className="text-left py-2 font-medium">Keterangan</th>
                      <th className="text-left py-2 font-medium">Jenis</th>
                      <th className="text-right py-2 font-medium">Jumlah</th>
                      <th className="text-right py-2 font-medium no-print" />
                    </tr>
                  </thead>
                  <tbody>
                    {s.lines.map((l, i) => (
                      <tr key={i} className="border-b border-[#f6f3f2]">
                        <td className="py-2.5 text-[#6e7a74] whitespace-nowrap">{l.date}</td>
                        <td className="py-2.5 text-[#0d2137]">{l.description}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#f6f3f2] text-[#3e4944] text-xs font-medium">
                            {l.type}
                          </span>
                        </td>
                        <td className={`py-2.5 text-right tabular-nums font-semibold ${
                          l.outgoing ? "text-[#0d2137]" : "text-[#0d8f66]"}`}>
                          {l.outgoing ? "" : "+ "}{fmt(l.amount)}
                        </td>
                        <td className="py-2.5 text-right no-print">
                          {l.receiptId && (
                            <Link href={`/dashboard/receipts/${l.receiptId}`}
                                  className="text-xs text-[#1a7a5e] font-semibold hover:underline">
                              Kuitansi
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                    {s.lines.length === 0 && (
                      <tr><td colSpan={5} className="py-10 text-center text-[#6e7a74]">
                        Belum ada transaksi pada periode ini.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-xs text-[#6e7a74] mt-8 pt-4 border-t border-[#e4e2e1]">
              Dokumen ini dibuat otomatis dari catatan keuangan VeriHome.
              <span className="block">Generated from VeriHome&apos;s financial records.</span>
            </p>
          </article>
        </div>
      </main>
    </>
  );
}

function Summary({ label, labelEn, value, tone }: {
  label: string; labelEn: string; value: number; tone?: "held" | "credit";
}) {
  return (
    <div className={`rounded-lg p-4 ${
      tone === "held" ? "bg-[#f6f3f2]" : tone === "credit" ? "bg-[#e8f5f0]" : "bg-[#f6f3f2]"
    }`}>
      <p className="text-xs font-bold uppercase tracking-wider text-[#3e4944]">{label}</p>
      <p className="text-[10px] text-[#6e7a74] mb-1">{labelEn}</p>
      <p className={`text-xl font-bold tabular-nums ${
        tone === "credit" ? "text-[#0d8f66]" : "text-[#0d2137]"}`}>
        IDR {fmt(value)}
      </p>
    </div>
  );
}
