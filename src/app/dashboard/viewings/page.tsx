import Link from "next/link";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreditCashbackCard } from "@/components/credits/CreditCashbackCard";
import { listRefundableCredits } from "@/lib/actions/credit-actions";
import { DepositPolicy } from "@/components/viewings/DepositPolicy";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:        { label: "Menunggu konfirmasi", cls: "bg-amber-100 text-amber-800" },
  confirmed:      { label: "Terjadwal",           cls: "bg-green-100 text-green-700" },
  attended:       { label: "Hadir",               cls: "bg-[#e8f5f0] text-[#1a7a5e]" },
  no_show:        { label: "Tidak hadir",         cls: "bg-red-100 text-red-700" },
  cancelled:      { label: "Dibatalkan",          cls: "bg-gray-200 text-gray-600" },
  refund_pending: { label: "Pengembalian diproses", cls: "bg-blue-50 text-blue-800" },
  refunded:       { label: "Dikembalikan",        cls: "bg-gray-200 text-gray-600" },
};

export default async function ViewingsPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();

  // This page used to render a hardcoded "No viewings scheduled" and never
  // query anything, so a guest with viewings saw none of them.
  const [{ data: viewings }, refundable] = await Promise.all([
    admin
      .from("viewings")
      .select(`id, status, deposit_amount, deposit_paid, credit_issued, scheduled_at,
               preferred_dates, created_at,
               property:properties ( name, area, slug )`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    listRefundableCredits(),
  ]);

  const rows = viewings ?? [];

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/viewings" userName={user.name} isActiveClient={user.is_active_client} />

      <main className="flex-1 ml-0 md:ml-72 p-6 md:p-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-[#0d2137] mb-1">Viewings</h2>
          <p className="text-[#3e4944]">Track your scheduled property viewings.</p>
        </header>

        {refundable.length > 0 && (
          <div className="mb-8">
            <CreditCashbackCard credits={refundable} />
          </div>
        )}

        {rows.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-[#e8f5f0] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-[#1a7a5e] text-4xl">location_on</span>
            </div>
            <h3 className="text-xl font-semibold text-[#1b1c1c] mb-2">No viewings scheduled</h3>
            <p className="text-[#3e4944] mb-6">
              Request a viewing from any listing page to schedule a physical visit.
            </p>
            <Link
              href="/listings"
              className="inline-block bg-[#1a7a5e] text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Browse Listings
            </Link>
          </div>
        ) : (
          <section className="bg-white rounded-xl border border-[#cccccc] shadow-sm divide-y divide-[#f0eeed]">
            {rows.map((v) => {
              const p = v.property as unknown as { name: string; area: string | null; slug: string } | null;
              const s = STATUS[v.status as string] ?? { label: String(v.status), cls: "bg-gray-100 text-gray-600" };
              const when = v.scheduled_at
                ? new Date(v.scheduled_at as string).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })
                : (v.preferred_dates as { date: string; time: string }[] | null)?.[0]
                  ? `${(v.preferred_dates as { date: string; time: string }[])[0].date} ${(v.preferred_dates as { date: string; time: string }[])[0].time} (diminta)`
                  : "—";

              return (
                <div key={v.id} className="p-5 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0d2137]">
                      {p?.slug ? (
                        <Link href={`/listings/${p.slug}`} className="hover:text-[#1a7a5e] hover:underline">
                          {p.name}
                        </Link>
                      ) : (p?.name ?? "—")}
                    </p>
                    <p className="text-xs text-[#6e7a74] mt-0.5">{p?.area}</p>
                    <p className="text-sm text-[#3e4944] mt-1.5">{when}</p>
                    <p className="text-xs text-[#6e7a74] mt-1">
                      Titipan {rp(Number(v.deposit_amount ?? 0))}
                      {v.credit_issued
                        ? " · sudah menjadi kredit"
                        : v.deposit_paid ? " · diterima" : " · belum dibayar"}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        <div className="mt-8 max-w-2xl">
          <DepositPolicy deposit={Number(process.env.VIEWING_DEPOSIT_AMOUNT ?? 50000)} />
        </div>
      </main>
    </div>
  );
}
