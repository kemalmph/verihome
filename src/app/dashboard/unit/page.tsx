import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { guestUnitOverview, guestSavedUnits } from "@/lib/guest/unit";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function StayCard({ label, stay }: { label: string; stay: { id: string; propertyName: string; propertyArea: string | null; checkIn: string; checkOut: string } }) {
  return (
    <Link href={`/dashboard/unit/${stay.id}`}
          className="block bg-white rounded-xl border-2 border-[#1a7a5e] p-6 hover:shadow-md transition-shadow">
      <p className="text-xs font-bold text-[#1a7a5e] uppercase tracking-wider">{label}</p>
      <h2 className="text-xl font-bold text-[#0d2137] mt-2">{stay.propertyName}</h2>
      {stay.propertyArea && <p className="text-sm text-[#6e7a74]">{stay.propertyArea}</p>}
      <p className="text-sm text-[#3e4944] mt-3">{day(stay.checkIn)} → {day(stay.checkOut)}</p>
      <p className="text-sm text-[#1a7a5e] font-semibold mt-3">Lihat detail unit →</p>
    </Link>
  );
}

export default async function UnitPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/dashboard/unit");

  const [overview, saved] = await Promise.all([guestUnitOverview(), guestSavedUnits()]);
  const primary = overview.current ?? overview.next ?? overview.past;
  const label = overview.current ? t("unit.current") : overview.next ? t("unit.next") : t("unit.past");

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/unit" userName={user.name} isActiveClient={user.is_active_client} />
      <main className="flex-1 ml-0 md:ml-72 p-6 md:p-12 pt-20 md:pt-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-[#0d2137] mb-8">{t("unit.title")}</h1>

        {primary ? (
          <div className="mb-8"><StayCard label={label} stay={primary} /></div>
        ) : (
          <p className="text-[#3e4944] mb-8">{t("unit.none")}</p>
        )}

        {overview.tenancy && (
          <section className="mb-8 bg-white rounded-xl border border-[#cccccc] p-6">
            <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider">{t("tenancy.title")}</p>
            <h2 className="text-lg font-bold text-[#0d2137] mt-2">{overview.tenancy.propertyName}</h2>
            {overview.tenancy.propertyArea && <p className="text-sm text-[#6e7a74]">{overview.tenancy.propertyArea}</p>}
            {overview.tenancy.propertyAddress && (
              <p className="text-sm text-[#3e4944] mt-2">{overview.tenancy.propertyAddress}</p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[#6e7a74] text-xs">{t("tenancy.monthlyRent")}</dt>
                <dd className="font-semibold text-[#0d2137]">{rp(overview.tenancy.monthlyRent)}</dd>
              </div>
              {overview.tenancy.leaseStart && (
                <div>
                  <dt className="text-[#6e7a74] text-xs">{t("tenancy.leaseStart")}</dt>
                  <dd className="font-semibold text-[#0d2137]">{day(overview.tenancy.leaseStart)}</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-[#6e7a74] mt-4">
              Butuh bantuan soal properti ini? Hubungi dukungan VeriHome.
            </p>
          </section>
        )}

        {(overview.next && overview.current) && (
          <div className="mb-8"><StayCard label={t("unit.next")} stay={overview.next} /></div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider">{t("saved.title")}</h2>
            <Link href="/dashboard/saved" className="text-sm text-[#1a7a5e] font-medium hover:underline">
              Semua →
            </Link>
          </div>
          {saved.length === 0 ? (
            <p className="text-sm text-[#3e4944] bg-white rounded-xl border border-[#cccccc] p-5">{t("saved.none")}</p>
          ) : (
            <div className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
              {saved.slice(0, 4).map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0d2137]">{s.name}</p>
                    <p className="text-xs text-[#6e7a74]">{s.area}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#0d2137] tabular-nums shrink-0">
                    {rp(s.currentPrice)}{s.isShortStay ? "/mlm" : "/bln"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
