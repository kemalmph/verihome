import { requireSitePage } from "@/lib/auth/site-access";
import { hasSitePermission, type SitePermission } from "@/lib/auth/site-permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMemberships, listPlans, type MembershipRow } from "@/lib/actions/membership-actions";
import { NewMembershipForm, NewPlanForm, MembershipControls } from "./MemberForms";

export const dynamic = "force-dynamic";

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const tgl = (ymd: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })
    .format(new Date(`${ymd}T00:00:00+07:00`));

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const access = await requireSitePage(param, "site.members.view");
  const id = access.siteId;
  const can = (p: SitePermission) => hasSitePermission(access.perms, p);

  const admin = createAdminClient();
  const { data: site } = await admin.from("sites").select("id, name, slug").eq("id", id).maybeSingle();
  if (!site) notFound();

  const [members, plans] = await Promise.all([listMemberships(id), listPlans(id)]);

  const active = members.filter((m) => m.status === "active");
  const endingSoon = active.filter((m) => m.days_left >= 0 && m.days_left <= 30);
  // Who has not paid is billing information (site.billing); front office
  // handles members, not their payments.
  const unpaid = can("site.billing")
    ? members.filter((m) => m.status !== "cancelled" && m.payment_status !== "paid")
    : [];

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref={`/site/${site.slug}/members`} />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <nav className="text-sm text-ink-3 mb-4">
          <Link href="/site" className="hover:underline">Site</Link>
          <span className="mx-2">/</span>
          <Link href={`/site/${site.slug}`} className="hover:underline">{site.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-2">Member</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-ink">Member</h1>
          <p className="text-ink-2 mt-1">
            {active.length} aktif dari {members.length} · {plans.length} paket
          </p>
        </header>

        {(endingSoon.length > 0 || unpaid.length > 0) && (
          <section className="mb-8 bg-white border border-line rounded-2xl shadow-card overflow-hidden">
            <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-ink">Perlu tindakan</h2>
            <ul className="divide-y divide-[#e8e3e0] text-sm">
              {endingSoon.map((m) => (
                <li key={`e-${m.id}`} className="px-5 py-3 flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-[#d79a2b]" />
                  <span className="text-ink-2">
                    {m.holder} — membership berakhir {tgl(m.ends_on)}, {m.days_left} hari lagi
                  </span>
                </li>
              ))}
              {unpaid.map((m) => (
                <li key={`u-${m.id}`} className="px-5 py-3 flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-[#c2503c]" />
                  <span className="text-ink-2">
                    {m.holder} — {rupiah(m.price)} belum lunas
                    {m.company_name && ` (tagihan ke ${m.company_name})`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── members ─────────────────────────────────────────────────── */}
        <section className="bg-white border border-line rounded-2xl shadow-card overflow-x-auto mb-8">
          <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-ink">
            Daftar member ({members.length})
          </h2>
          {members.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-ink font-semibold">Belum ada member</p>
              <p className="text-ink-3 text-sm mt-1 max-w-md mx-auto">
                Member adalah orang yang punya hubungan berjalan dengan site ini —
                berbeda dari penyewa yang memegang satu unit untuk satu periode.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[980px]">
              <thead className="text-left">
                <tr className="border-b border-[#e8e3e0]">
                  <Th>Member</Th><Th>Paket</Th><Th>Periode</Th>
                  <Th className="text-right">Harga</Th><Th>Kuota bulan ini</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <Row key={m.id} m={m} siteId={site.id}
                    canStatus={can("site.members")} canPayment={can("site.billing")} />
                ))}
              </tbody>
            </table>
          )}
        </section>

        {can("site.members") && (
          <div className="mb-10">
            <NewMembershipForm siteId={site.id} plans={plans} />
          </div>
        )}

        {/* ── plans ───────────────────────────────────────────────────── */}
        <section className="bg-white border border-line rounded-2xl shadow-card overflow-x-auto">
          <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-ink">
            Paket ({plans.length})
          </h2>
          {plans.length === 0 ? (
            <p className="p-8 text-center text-ink-3 text-sm">
              Belum ada paket. Paket Virtual Office 1/2/3 cocok dimasukkan di sini.
            </p>
          ) : (
            <table className="w-full text-sm min-w-[820px]">
              <thead className="text-left">
                <tr className="border-b border-[#e8e3e0]">
                  <Th>Paket</Th><Th className="text-right">Harga</Th>
                  <Th className="text-right">Day pass</Th><Th className="text-right">Jam rapat</Th>
                  <Th className="text-right">Diskon</Th><Th>Lain-lain</Th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-[#f0ecea] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{p.name}</div>
                      <div className="text-xs text-ink-3">
                        {p.site_id === null ? "semua site" : "site ini"} · {p.period === "yearly" ? "tahunan" : "bulanan"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">{rupiah(p.price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">{p.day_passes_per_month || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">{p.meeting_room_hours_per_month || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">{p.discount_pct ? `${p.discount_pct}%` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-3">
                      {[p.hot_desk_included && "hot desk", p.mail_handling && "surat", p.address_use && "alamat"]
                        .filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {can("site.catalog") && (
            <div className="px-5 py-3 border-t border-[#e8e3e0]">
              {/* A plan for every site is a global decision (createPlan enforces it). */}
              <NewPlanForm siteId={site.id} allowAllSites={access.actor.global.includes("site.catalog")} />
            </div>
          )}
        </section>

        <p className="text-xs text-ink-3 mt-6 max-w-3xl">
          Kuota dihitung dari booking yang menunjuk membership ini, dalam bulan
          berjalan waktu Jakarta — bukan saldo yang disimpan, supaya tidak bisa
          berbeda dari bookingnya. Penandaan lunas di sini belum terhubung ke buku
          besar: iuran setahun dibayar di muka adalah kewajiban 12 bulan, dan cara
          mengakuinya masih perlu diputuskan.
        </p>
      </main>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3 ${className}`}>
      {children}
    </th>
  );
}

function Row({ m, siteId, canStatus, canPayment }: {
  m: MembershipRow; siteId: string; canStatus: boolean; canPayment: boolean;
}) {
  return (
    <tr className="border-b border-[#f0ecea] last:border-0 hover:bg-[#faf9f8]">
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{m.holder}</div>
        <div className="text-xs text-ink-3">
          {m.membership_code}
          {m.company_name && ` · ditagih ke ${m.company_name}`}
          {m.member_contact && ` · ${m.member_contact}`}
        </div>
      </td>
      <td className="px-4 py-3 text-ink-2">{m.plan_name ?? "—"}</td>
      <td className="px-4 py-3 text-ink-2">
        {tgl(m.starts_on)} – {tgl(m.ends_on)}
        <div className="text-xs text-ink-3">
          {m.days_left >= 0 ? `${m.days_left} hari lagi` : `lewat ${Math.abs(m.days_left)} hari`}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-ink-2">{rupiah(m.price)}</td>
      <td className="px-4 py-3">
        <Quota used={m.used_hours} total={m.meeting_room_hours_per_month} unit="jam rapat" />
        <Quota used={m.used_passes} total={m.day_passes_per_month} unit="day pass" />
        {m.meeting_room_hours_per_month === 0 && m.day_passes_per_month === 0 && (
          <span className="text-xs text-ink-3">tanpa kuota</span>
        )}
      </td>
      <td className="px-4 py-3">
        <MembershipControls
          siteId={siteId}
          membershipId={m.id}
          status={m.status}
          paymentStatus={m.payment_status}
          canStatus={canStatus}
          canPayment={canPayment}
        />
      </td>
    </tr>
  );
}

function Quota({ used, total, unit }: { used: number; total: number; unit: string }) {
  if (total === 0) return null;
  const over = used > total;
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div className="mb-1 last:mb-0">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-ink-3">{unit}</span>
        <span className={over ? "text-[#8c3a2c] font-medium" : "text-ink-2 tabular-nums"}>
          {used} / {total}
        </span>
      </div>
      <div className="w-28 bg-line h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${over ? "bg-[#c2503c]" : "bg-brand"}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}
