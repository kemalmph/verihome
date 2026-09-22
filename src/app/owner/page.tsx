import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";
import { requireOwner } from "@/lib/auth/guards";
import { ownerProperties, ownerBookings, ownerEarnings } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
const day = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

const PIPELINE: Record<string, { label: string; cls: string }> = {
  new_lead:         { label: "Prospek baru",     cls: "bg-gray-100 text-gray-600" },
  owner_approved:   { label: "Disetujui pemilik", cls: "bg-gray-100 text-gray-600" },
  survey_scheduled: { label: "Survei dijadwalkan", cls: "bg-amber-100 text-amber-800" },
  survey_completed: { label: "Survei selesai",   cls: "bg-amber-100 text-amber-800" },
  draft:            { label: "Draf",             cls: "bg-amber-100 text-amber-800" },
  approved:         { label: "Siap tayang",      cls: "bg-blue-50 text-blue-800" },
  live:             { label: "Tayang",           cls: "bg-[#e8f5f0] text-[#12614a]" },
  closed:           { label: "Ditutup",          cls: "bg-gray-200 text-gray-600" },
  archived:         { label: "Diarsipkan",       cls: "bg-gray-200 text-gray-600" },
};

export default async function OwnerOverviewPage() {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }

  const [properties, bookings, earnings] = await Promise.all([
    ownerProperties(), ownerBookings(), ownerEarnings(),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();

  const thisMonth = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "expired" &&
           new Date(`${b.checkIn}T00:00:00`) <= monthEnd &&
           new Date(`${b.checkOut}T00:00:00`) >= monthStart
  );
  const nightsBooked = thisMonth.reduce((s, b) => s + b.nights, 0);
  const monthEarnings = thisMonth.reduce((s, b) => s + b.toOwner, 0);
  const capacity = Math.max(1, properties.length * daysInMonth);
  const occupancy = Math.min(100, Math.round((nightsBooked / capacity) * 100));

  const in14 = new Date(now.getTime() + 14 * 86_400_000);
  const upcoming = bookings
    .filter((b) => b.status === "confirmed")
    .flatMap((b) => [
      { kind: "in" as const, date: b.checkIn, b },
      { kind: "out" as const, date: b.checkOut, b },
    ])
    .filter((e) => {
      const d = new Date(`${e.date}T00:00:00`);
      return d >= new Date(now.toDateString()) && d <= in14;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Things only the owner can resolve.
  const actions: { label: string; href: string }[] = [];
  for (const p of properties) {
    if (p.status !== "live" && ["draft", "approved", "survey_completed"].includes(p.status as string)) {
      actions.push({
        label: `${p.name} belum tayang — lihat yang masih kurang`,
        href: `/owner/properties/${p.id}`,
      });
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <OwnerSidebar activeHref="/owner" ownerName={owner.ownerName} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-10 pt-20 md:pt-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">{t("owner.overview.title")}</h1>
          <p className="text-[#3e4944] mt-1">{t("owner.overview.subtitle")}</p>
        </header>

        {properties.length === 0 ? (
          <p className="text-[#3e4944]">{t("owner.overview.noProperties")}</p>
        ) : (
          <>
            {/* This month */}
            <section className="mb-8">
              <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
                {t("owner.overview.thisMonth")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: t("owner.overview.nightsBooked"), value: String(nightsBooked) },
                  { label: t("owner.overview.occupancy"),    value: `${occupancy}%` },
                  { label: t("owner.overview.earnings"),     value: rp(monthEarnings) },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl border border-[#cccccc] p-5">
                    <p className="text-xs text-[#6e7a74]">{s.label}</p>
                    <p className="text-2xl font-bold text-[#0d2137] mt-1 tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Balance */}
            <section className="mb-8 bg-white rounded-xl border border-[#cccccc] p-5">
              <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
                {t("owner.balance.title")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-[#6e7a74]">{t("owner.balance.earned")}</p>
                  <p className="text-lg font-semibold text-[#0d2137] tabular-nums">{rp(earnings.earned)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6e7a74]">{t("owner.balance.paid")}</p>
                  <p className="text-lg font-semibold text-[#0d2137] tabular-nums">{rp(earnings.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6e7a74]">{t("owner.balance.outstanding")}</p>
                  <p className="text-lg font-bold text-[#1a7a5e] tabular-nums">{rp(earnings.outstanding)}</p>
                </div>
              </div>
              <p className="text-[11px] text-[#6e7a74] mt-3">{t("owner.balance.fromLedger")}</p>
            </section>

            {/* Needs action */}
            <section className="mb-8">
              <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
                {t("owner.overview.needsAction")}
              </h2>
              {actions.length === 0 ? (
                <p className="text-sm text-[#3e4944] bg-white rounded-xl border border-[#cccccc] p-5">
                  {t("owner.overview.allClear")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {actions.map((a) => (
                    <li key={a.href + a.label}>
                      <Link href={a.href} className="block bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 hover:bg-amber-100">
                        {a.label} →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Upcoming */}
            <section className="mb-8">
              <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
                {t("owner.overview.upcoming")}
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-[#3e4944] bg-white rounded-xl border border-[#cccccc] p-5">
                  {t("owner.overview.noUpcoming")}
                </p>
              ) : (
                <ul className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
                  {upcoming.map((e, i) => (
                    <li key={`${e.b.id}-${e.kind}-${i}`} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-[#0d2137]">
                          {e.kind === "in" ? "Check-in" : "Check-out"} · {day(e.date)}
                        </p>
                        <p className="text-xs text-[#6e7a74]">
                          {e.b.propertyName} · {e.b.guestFirstName} · {e.b.guests} tamu
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        e.kind === "in" ? "bg-[#e8f5f0] text-[#12614a]" : "bg-blue-50 text-blue-800"
                      }`}>
                        {e.kind === "in" ? "masuk" : "keluar"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Properties */}
            <section>
              <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
                {t("owner.nav.properties")}
              </h2>
              <div className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
                {properties.map((p) => {
                  const s = PIPELINE[p.status as string] ?? { label: String(p.status), cls: "bg-gray-100 text-gray-600" };
                  return (
                    <Link
                      key={p.id as string}
                      href={`/owner/properties/${p.id}`}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-[#f6f3f2] flex-wrap"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#0d2137]">{p.name as string}</p>
                        <p className="text-xs text-[#6e7a74]">{(p.area as string) ?? ""}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${s.cls}`}>
                        {s.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
