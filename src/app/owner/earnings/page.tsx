import { redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";
import { requireOwner } from "@/lib/auth/guards";
import { ownerEarnings } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;

export default async function OwnerEarningsPage() {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }
  const e = await ownerEarnings();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <OwnerSidebar activeHref="/owner/earnings" ownerName={owner.ownerName} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 max-w-3xl">
        <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-[#0d2137]">{t("owner.earnings.title")}</h1>
          <a href="/owner/earnings/statement"
             className="px-4 py-2 border border-[#1a7a5e] text-[#1a7a5e] text-sm font-semibold rounded-lg hover:bg-[#e8f5f0]">
            {t("owner.earnings.statement")}
          </a>
        </header>

        <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[#6e7a74]">{t("owner.balance.earned")}</p>
              <p className="text-lg font-semibold text-[#0d2137] tabular-nums">{rp(e.earned)}</p>
            </div>
            <div>
              <p className="text-xs text-[#6e7a74]">{t("owner.balance.paid")}</p>
              <p className="text-lg font-semibold text-[#0d2137] tabular-nums">{rp(e.paid)}</p>
            </div>
            <div>
              <p className="text-xs text-[#6e7a74]">{t("owner.balance.outstanding")}</p>
              <p className="text-lg font-bold text-[#1a7a5e] tabular-nums">{rp(e.outstanding)}</p>
            </div>
          </div>
          <p className="text-[11px] text-[#6e7a74] mt-3">{t("owner.balance.fromLedger")}</p>
        </section>

        {e.perBooking.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">Per pemesanan</h2>
            <div className="bg-white rounded-xl border border-[#cccccc] overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 560 }}>
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                    <th className="text-left px-4 py-2 font-medium">Pemesanan</th>
                    <th className="text-right px-3 py-2 font-medium">{t("owner.earnings.gross")}</th>
                    <th className="text-right px-3 py-2 font-medium">{t("owner.earnings.commission")}</th>
                    <th className="text-right px-3 py-2 font-medium">{t("owner.earnings.cleaning")}</th>
                    <th className="text-right px-4 py-2 font-medium">{t("owner.earnings.net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {e.perBooking.map((b) => (
                    <tr key={b.id} className="border-b border-[#f0eeed] last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="block text-[#0d2137]">{b.propertyName}</span>
                        <span className="block text-xs text-[#6e7a74]">{b.code} · {b.checkIn}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{rp(b.gross)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">− {rp(b.commission)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        {b.cleaning > 0 ? (b.cleaningToOwner ? `+ ${rp(b.cleaning)}` : `VeriHome`) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#1a7a5e] tabular-nums">{rp(b.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">{t("owner.earnings.payouts")}</h2>
          {e.payouts.length === 0 ? (
            <p className="text-sm text-[#3e4944] bg-white rounded-xl border border-[#cccccc] p-5">
              {t("owner.earnings.none")}
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
              {e.payouts.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#0d2137]">{p.date}</p>
                    <p className="text-xs text-[#6e7a74]">{p.reference}</p>
                  </div>
                  <p className="font-semibold text-[#0d2137] tabular-nums">{rp(p.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
