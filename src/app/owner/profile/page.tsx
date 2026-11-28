import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requireOwner } from "@/lib/auth/guards";
import { ownerProfile } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";
import { PayoutAccount } from "./PayoutAccount";
import { OwnerDocuments } from "./OwnerDocuments";

export const dynamic = "force-dynamic";

export default async function OwnerProfilePage() {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }
  const p = await ownerProfile();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AppSidebar activeHref="/owner/profile" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-10 pt-20 md:pt-10 max-w-2xl">
        <h1 className="text-3xl font-bold text-ink mb-6">{t("owner.profile.title")}</h1>

        <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
          <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">
            {t("owner.profile.contact")}
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Nama</dt>
              <dd className="text-ink font-medium">{p.owner.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Email</dt>
              <dd className="text-ink">{p.owner.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">WhatsApp</dt>
              <dd className="text-ink">{p.owner.phone ?? "—"}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-ink-3 mt-3">
            Untuk mengubah data kontak, hubungi tim Cosystem.
          </p>
        </section>

        <PayoutAccount
          current={{
            bank: p.owner.payoutBank,
            accountMasked: p.owner.payoutAccountMasked,
            holder: p.owner.payoutHolder,
            verifiedAt: p.owner.payoutVerifiedAt,
          }}
          pending={p.pendingPayoutChange}
        />

        <OwnerDocuments documents={p.documents} />
      </main>
    </div>
  );
}
