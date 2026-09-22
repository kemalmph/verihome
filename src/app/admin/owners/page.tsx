import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerPortalControls } from "./OwnerPortalControls";

export const dynamic = "force-dynamic";

export default async function AdminOwnersPage() {
  await requireAdmin();

  const admin = createAdminClient();
  const [{ data: owners }, { data: properties }] = await Promise.all([
    admin
      .from("owners")
      .select("id, name, email, phone_whatsapp, portal_access, user_id, invited_at, activated_at")
      .order("name"),
    admin.from("properties").select("id, owner_id"),
  ]);

  const countByOwner = new Map<string, number>();
  for (const p of properties ?? []) {
    const k = p.owner_id as string | null;
    if (k) countByOwner.set(k, (countByOwner.get(k) ?? 0) + 1);
  }

  const linked = (owners ?? []).filter((o) => o.portal_access === "active").length;

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/owners" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">Pemilik</h1>
          <p className="text-[#3e4944] mt-1">
            {owners?.length ?? 0} pemilik · {linked} aktif di portal
          </p>
        </header>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 max-w-3xl">
          <p className="text-sm text-amber-900">
            <strong>Undangan hanya dari sini.</strong> Portal tidak pernah menghubungkan
            akun berdasarkan email yang diketik pemilik — siapa pun bisa mengaku
            memiliki properti orang lain dengan cara itu. Tautan mengikat satu
            akun ke satu data pemilik yang Anda pilih.
          </p>
        </div>

        {(owners ?? []).length === 0 ? (
          <p className="text-[#3e4944]">Belum ada pemilik.</p>
        ) : (
          <div className="space-y-4">
            {(owners ?? []).map((o) => (
              <section key={o.id} className="bg-white rounded-xl border border-[#cccccc] shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0d2137]">{o.name}</p>
                    <p className="text-xs text-[#6e7a74] mt-0.5">
                      {o.email ?? "tanpa email"}
                      {o.phone_whatsapp ? ` · ${o.phone_whatsapp}` : ""}
                      {" · "}
                      {countByOwner.get(o.id as string) ?? 0} properti
                    </p>
                  </div>
                  <Link
                    href={`/admin/owners/${o.id}/statement`}
                    className="text-[#1a7a5e] text-sm font-medium hover:underline shrink-0"
                  >
                    Laporan →
                  </Link>
                </div>

                <OwnerPortalControls
                  ownerId={o.id as string}
                  ownerName={o.name as string}
                  portalAccess={(o.portal_access as "none" | "invited" | "active" | "revoked") ?? "none"}
                  hasWhatsApp={Boolean(o.phone_whatsapp)}
                />
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
