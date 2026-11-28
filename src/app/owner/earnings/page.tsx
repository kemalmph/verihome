import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
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
      <AppSidebar activeHref="/owner/earnings" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-10 pt-20 md:pt-10 max-w-3xl">
        <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-ink">{t("owner.earnings.title")}</h1>
          <a href="/owner/earnings/statement"
             className="px-4 py-2 border border-brand text-brand-ink text-sm font-semibold rounded-lg hover:bg-brand-soft">
            {t("owner.earnings.statement")}
          </a>
        </header>

        <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-ink-3">{t("owner.balance.earned")}</p>
              <p className="text-lg font-semibold text-ink tabular-nums">{rp(e.earned)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-3">{t("owner.balance.paid")}</p>
              <p className="text-lg font-semibold text-ink tabular-nums">{rp(e.paid)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-3">{t("owner.balance.outstanding")}</p>
              <p className="text-lg font-bold text-brand-ink tabular-nums">{rp(e.outstanding)}</p>
            </div>
          </div>
          <p className="text-[11px] text-ink-3 mt-3">{t("owner.balance.fromLedger")}</p>
        </section>

        {e.perBooking.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">Per pemesanan</h2>
            <div className="bg-white rounded-xl border border-[#cccccc] overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 560 }}>
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-ink-3 border-b border-[#e4e2e1]">
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
                        <span className="block text-ink">{b.propertyName}</span>
                        <span className="block text-xs text-ink-3">{b.code} · {b.checkIn}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{rp(b.gross)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">− {rp(b.commission)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        {b.cleaning > 0 ? (b.cleaningToOwner ? `+ ${rp(b.cleaning)}` : `Cosystem`) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-brand-ink tabular-nums">{rp(b.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">{t("owner.earnings.payouts")}</h2>
          {e.payouts.length === 0 ? (
            <p className="text-sm text-ink-2 bg-white rounded-xl border border-[#cccccc] p-5">
              {t("owner.earnings.none")}
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
              {e.payouts.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink">{p.date}</p>
                    <p className="text-xs text-ink-3">{p.reference}</p>
                  </div>
                  <p className="font-semibold text-ink tabular-nums">{rp(p.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
