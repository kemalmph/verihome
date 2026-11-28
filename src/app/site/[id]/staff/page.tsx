import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requireSitePage } from "@/lib/auth/site-access";
import { listSiteStaff } from "@/lib/actions/site-staff-actions";
import { SITE_ROLE_LABELS } from "@/lib/auth/site-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm, RevokeInviteButton, RevokeRoleButton } from "./StaffForms";

export const dynamic = "force-dynamic";

const tgl = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })
    .format(new Date(iso));

const STATE_LABEL = { open: "Menunggu", redeemed: "Dipakai", revoked: "Dibatalkan", expired: "Kedaluwarsa" } as const;

/** Site staff: who works here, in which role, and the invites still out. */
export default async function SiteStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const access = await requireSitePage(param, "site.staff");
  const { data: site } = await createAdminClient()
    .from("sites").select("id, name, slug").eq("id", access.siteId).maybeSingle();
  if (!site) notFound();
  const { owner, staff, invites, invitable } = await listSiteStaff(access.siteId);

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref={`/site/${site.slug}/staff`} />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12 max-w-[1100px]">
        <nav className="text-sm text-ink-3 mb-4">
          <Link href={`/site/${site.slug}`} className="hover:underline">{site.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-2">Staf</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-ink">Staf site</h1>
          <p className="text-ink-2 mt-1">
            Peran berlaku hanya di {site.name}. Mencabut peran berlaku pada permintaan berikutnya.
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-line shadow-card overflow-hidden mb-8">
          <h2 className="px-5 py-3 bg-canvas text-sm font-semibold text-ink">Pemilik & staf</h2>
          <ul className="divide-y divide-line text-sm">
            <li className="px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-ink">{owner?.name ?? "Belum ditetapkan"}</div>
                {owner?.email && <div className="text-xs text-ink-3">{owner.email}</div>}
              </div>
              <span className="text-xs rounded-full bg-brand-soft text-brand-ink px-2.5 py-1 font-semibold">
                {SITE_ROLE_LABELS.owner}
              </span>
            </li>
            {staff.length === 0 && <li className="px-5 py-6 text-ink-3">Belum ada staf.</li>}
            {staff.map((s) => (
              <li key={`${s.user_id}-${s.role}`} className="px-5 py-3 flex items-center justify-between gap-4" data-staff-row={`${s.email}|${s.role}`}>
                <div>
                  <div className="font-medium text-ink">{s.name ?? s.email ?? "—"}</div>
                  <div className="text-xs text-ink-3">{s.email} · sejak {tgl(s.granted_at)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs rounded-full bg-canvas text-ink-2 px-2.5 py-1 font-semibold">
                    {SITE_ROLE_LABELS[s.role]}
                  </span>
                  {s.revocable && <RevokeRoleButton siteId={site.id} userId={s.user_id} role={s.role} />}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {invitable.length > 0 && (
          <div className="mb-8">
            <InviteForm siteId={site.id} roles={invitable} />
          </div>
        )}

        <section className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
          <h2 className="px-5 py-3 bg-canvas text-sm font-semibold text-ink">Undangan</h2>
          {invites.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3">Belum ada undangan.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {invites.map((i) => (
                <li key={i.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-ink">{i.email}</div>
                    <div className="text-xs text-ink-3">
                      {SITE_ROLE_LABELS[i.role]} · dibuat {tgl(i.created_at)} · berlaku sampai {tgl(i.expires_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-3">{STATE_LABEL[i.state]}</span>
                    {i.revocable && <RevokeInviteButton inviteId={i.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
