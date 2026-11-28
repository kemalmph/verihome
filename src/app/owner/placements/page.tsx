import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requireOwner } from "@/lib/auth/guards";
import { ownerPlacements, ownerProperties } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";
import { ReportPlacement } from "./ReportPlacement";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;

const STATUS: Record<string, { label: string; cls: string }> = {
  reported:    { label: "dilaporkan",     cls: "bg-amber-100 text-amber-800" },
  invoiced:    { label: "ditagih",        cls: "bg-blue-50 text-blue-800" },
  paid:        { label: "lunas",          cls: "bg-success-soft text-success-ink" },
  disputed:    { label: "disengketakan",  cls: "bg-red-100 text-red-700" },
  written_off: { label: "dihapusbukukan", cls: "bg-gray-200 text-gray-600" },
};

export default async function OwnerPlacementsPage() {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }
  const [placements, properties] = await Promise.all([ownerPlacements(), ownerProperties()]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref="/owner/placements" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-10 pt-20 md:pt-10 max-w-3xl">
        <h1 className="text-3xl font-bold text-ink mb-6">{t("owner.placements.title")}</h1>

        <section className="bg-white rounded-2xl border border-line shadow-card p-5 mb-8">
          <h2 className="font-semibold text-ink text-sm">{t("owner.placements.report")}</h2>
          <p className="text-xs text-ink-3 mt-1 mb-4 max-w-xl">{t("owner.placements.reportNote")}</p>
          <ReportPlacement properties={properties.map((p) => ({ id: p.id as string, name: p.name as string }))} />
        </section>

        {placements.length === 0 ? (
          <p className="text-ink-2">{t("owner.placements.none")}</p>
        ) : (
          <div className="bg-white rounded-2xl border border-line shadow-card divide-y divide-[#f0eeed]">
            {placements.map((p) => {
              const s = STATUS[p.status] ?? { label: p.status, cls: "bg-gray-100 text-gray-600" };
              return (
                <div key={p.id} className="p-5 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{p.propertyName}</p>
                    <p className="text-sm text-ink-2 mt-0.5">
                      {rp(p.monthlyRent)}/bulan{p.leaseStart ? ` · mulai ${p.leaseStart}` : ""}
                    </p>
                    <p className="text-xs text-ink-3 mt-1">
                      Komisi {p.commissionPct}% · {rp(p.commissionAmount)}
                      {p.reportedBy === "owner" ? " · dilaporkan oleh Anda" : ""}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${s.cls}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
