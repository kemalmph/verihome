import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";
import { requireOwner } from "@/lib/auth/guards";
import { ownerProperties } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

export default async function OwnerPropertiesPage() {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }
  const properties = await ownerProperties();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <OwnerSidebar activeHref="/owner/properties" ownerName={owner.ownerName} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 max-w-3xl">
        <h1 className="text-3xl font-bold text-[#0d2137] mb-8">{t("owner.nav.properties")}</h1>

        {properties.length === 0 ? (
          <p className="text-[#3e4944]">{t("owner.overview.noProperties")}</p>
        ) : (
          <div className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
            {properties.map((p) => (
              <Link key={p.id as string} href={`/owner/properties/${p.id}`}
                    className="p-5 flex items-center justify-between gap-3 hover:bg-[#f6f3f2] flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0d2137]">{p.name as string}</p>
                  <p className="text-xs text-[#6e7a74] mt-0.5">{(p.area as string) ?? ""}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                  p.status === "live" ? "bg-[#e8f5f0] text-[#12614a]" : "bg-amber-100 text-amber-800"
                }`}>
                  {p.status === "live" ? "tayang" : "belum tayang"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
