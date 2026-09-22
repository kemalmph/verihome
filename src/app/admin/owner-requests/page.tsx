import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { listPendingOwnerRequests, maskAccount } from "@/lib/actions/owner-request-actions";
import { t } from "@/lib/i18n/strings";
import { RequestActions } from "./RequestActions";

export const dynamic = "force-dynamic";

const fmt = (v: unknown) =>
  v == null ? "—" : new Intl.NumberFormat("id-ID").format(Number(v));

const RATE_FIELDS: [string, string][] = [
  ["price_per_night", "Per malam"],
  ["price_per_week",  "Per minggu"],
  ["price_per_month", "Per bulan"],
  ["cleaning_fee",    "Kebersihan"],
  ["min_nights",      "Min. malam"],
];

export default async function AdminOwnerRequestsPage() {
  await requireAdmin();
  const requests = await listPendingOwnerRequests();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/owner-requests" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">{t("admin.requests.title")}</h1>
          <p className="text-[#3e4944] mt-1">{requests.length} menunggu</p>
        </header>

        {requests.length === 0 ? (
          <p className="text-[#3e4944] bg-white rounded-xl border border-[#cccccc] p-6">
            {t("admin.requests.none")}
          </p>
        ) : (
          <div className="space-y-5">
            {requests.map((r) => {
              const isPayout = r.kind === "payout_account";
              return (
                <article key={r.id}
                         className={`bg-white rounded-xl border shadow-sm p-5 ${
                           isPayout ? "border-[#e2b3ab]" : "border-[#cccccc]"}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0d2137]">
                        {isPayout ? "Perubahan rekening pembayaran" : "Perubahan tarif"}
                      </p>
                      <p className="text-xs text-[#6e7a74] mt-0.5">
                        {r.ownerName}
                        {r.propertyName ? ` · ${r.propertyName}` : ""}
                        {" · "}
                        {r.ageDays === 0 ? "hari ini" : `${r.ageDays} hari lalu`}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                      isPayout ? "bg-[#fbeeec] text-[#8c3a2c]" : "bg-blue-50 text-blue-800"}`}>
                      {isPayout ? "rekening" : "tarif"}
                    </span>
                  </div>

                  {isPayout ? (
                    <>
                      <div className="bg-[#fbeeec] border border-[#e2b3ab] rounded-lg p-3 mb-3">
                        <p className="text-sm text-[#8c3a2c]">{t("admin.requests.payoutWarn")}</p>
                        {r.ownerPhone && (
                          <a href={`https://wa.me/${r.ownerPhone.replace(/\D/g, "")}`}
                             target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-[#8c3a2c] hover:underline">
                            <span className="material-symbols-outlined text-base">call</span>
                            {r.ownerPhone}
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="border border-[#e4e2e1] rounded-lg p-3">
                          <p className="text-[11px] font-bold text-[#6e7a74] uppercase tracking-wider mb-2">Sekarang</p>
                          <dl className="text-sm space-y-1">
                            <div className="flex justify-between gap-2"><dt className="text-[#6e7a74]">Bank</dt><dd>{String(r.previous?.payout_bank ?? "—")}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-[#6e7a74]">Rekening</dt><dd className="font-mono">{maskAccount(r.previous?.payout_account_number as string)}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-[#6e7a74]">Atas nama</dt><dd>{String(r.previous?.payout_account_holder ?? "—")}</dd></div>
                          </dl>
                        </div>
                        <div className="border-2 border-[#8c3a2c] rounded-lg p-3">
                          <p className="text-[11px] font-bold text-[#8c3a2c] uppercase tracking-wider mb-2">Diminta</p>
                          <dl className="text-sm space-y-1">
                            <div className="flex justify-between gap-2"><dt className="text-[#6e7a74]">Bank</dt><dd className="font-semibold">{String(r.proposed.bank ?? "—")}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-[#6e7a74]">Rekening</dt><dd className="font-mono font-semibold">{maskAccount(r.proposed.account_number as string)}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-[#6e7a74]">Atas nama</dt><dd className="font-semibold">{String(r.proposed.account_holder ?? "—")}</dd></div>
                          </dl>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" style={{ minWidth: 380 }}>
                        <thead>
                          <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                            <th className="text-left py-2 font-medium">Item</th>
                            <th className="text-right py-2 font-medium">Sekarang</th>
                            <th className="text-right py-2 font-medium">Diminta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {RATE_FIELDS.filter(([k]) => r.proposed[k] != null).map(([k, label]) => (
                            <tr key={k} className="border-b border-[#f0eeed] last:border-0">
                              <td className="py-2 text-[#3e4944]">{label}</td>
                              <td className="py-2 text-right tabular-nums text-[#6e7a74]">{fmt(r.previous?.[k])}</td>
                              <td className="py-2 text-right tabular-nums font-semibold text-[#0d2137]">{fmt(r.proposed[k])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {r.proposed.note ? (
                        <p className="text-xs text-[#3e4944] mt-2">Catatan pemilik: {String(r.proposed.note)}</p>
                      ) : null}
                      <p className="text-[11px] text-[#6e7a74] mt-2">{t("owner.request.rateNote")}</p>
                    </div>
                  )}

                  <RequestActions requestId={r.id} needsPhoneCheck={isPayout} />
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
