import { redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";
import { requireOwner } from "@/lib/auth/guards";
import { ownerViewings } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

export default async function OwnerViewingsPage() {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }
  const viewings = await ownerViewings();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <OwnerSidebar activeHref="/owner/viewings" ownerName={owner.ownerName} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 max-w-3xl">
        <h1 className="text-3xl font-bold text-[#0d2137] mb-6">{t("owner.viewings.title")}</h1>

        {viewings.length === 0 ? (
          <p className="text-[#3e4944]">{t("owner.viewings.none")}</p>
        ) : (
          <div className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
            {viewings.map((v) => {
              const when = v.scheduledAt
                ? new Date(v.scheduledAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })
                : v.preferred[0] ? `${v.preferred[0].date} ${v.preferred[0].time} (diminta)` : "—";
              return (
                <div key={v.id} className="p-5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0d2137]">{v.propertyName}</p>
                    <p className="text-sm text-[#3e4944] mt-0.5">{when}</p>
                    <p className="text-xs text-[#6e7a74] mt-1">{t("owner.viewings.prospect")}: {v.prospectFirstName}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f6f3f2] text-[#3e4944] shrink-0">
                    {v.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
