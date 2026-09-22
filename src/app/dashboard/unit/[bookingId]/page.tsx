import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { guestUnit, NotFoundError } from "@/lib/guest/unit";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
const day = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const SCORES: [string, string][] = [
  ["building_condition", "Bangunan"], ["natural_lighting", "Cahaya"],
  ["ventilation", "Udara"], ["noise_level", "Kebisingan"],
  ["cleanliness", "Kebersihan"], ["security_level", "Keamanan"],
  ["bathroom_condition", "Kamar mandi"], ["furniture_quality", "Perabot"],
];

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect(`/auth/login?next=/dashboard/unit/${bookingId}`);

  let u;
  try {
    u = await guestUnit(bookingId);
  } catch (e) {
    // Another guest's booking is not-found, exactly like one that never existed.
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/unit" userName={user.name} isActiveClient={user.is_active_client} />
      <main className="flex-1 ml-0 md:ml-72 p-6 md:p-12 pt-20 md:pt-12 max-w-3xl">
        <Link href="/dashboard/unit" className="text-sm text-[#1a7a5e] hover:underline">← {t("unit.title")}</Link>

        <header className="mt-3 mb-6">
          <h1 className="text-3xl font-bold text-[#0d2137]">{u.property.name}</h1>
          <p className="text-[#3e4944] mt-1">{u.property.area}</p>
        </header>

        {u.property.photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
            {u.property.photos.slice(0, 6).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt="" className="w-full aspect-[4/3] object-cover rounded-lg" />
            ))}
          </div>
        )}

        {/* Where and when */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
          <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">Alamat & jadwal</h2>

          {u.property.address ? (
            <>
              <p className="text-sm text-[#0d2137]">{u.property.address}</p>
              <a
                href={u.property.mapUrl ?? `https://maps.google.com/?q=${encodeURIComponent(u.property.address)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-[#1a7a5e] font-medium hover:underline"
              >
                <span className="material-symbols-outlined text-base">directions</span>
                {t("unit.directions")}
              </a>
            </>
          ) : (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t("unit.addressLocked")}
              <span className="block text-xs mt-0.5">{t("unit.addressLocked", "en")}</span>
            </p>
          )}

          <dl className="grid grid-cols-2 gap-4 mt-4 text-sm">
            <div>
              <dt className="text-xs text-[#6e7a74]">{t("unit.checkIn")}</dt>
              <dd className="font-semibold text-[#0d2137]">{day(u.booking.checkIn)}</dd>
              <dd className="text-xs text-[#6e7a74]">mulai {u.times.checkIn}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6e7a74]">{t("unit.checkOut")}</dt>
              <dd className="font-semibold text-[#0d2137]">{day(u.booking.checkOut)}</dd>
              <dd className="text-xs text-[#6e7a74]">sebelum {u.times.checkOut}</dd>
            </div>
          </dl>
        </section>

        {/* Rules and facilities */}
        {(u.rules || u.facilities.length > 0 || u.includedUtilities.length > 0) && (
          <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
            <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
              {t("unit.rules")} &amp; {t("unit.facilities")}
            </h2>
            {u.rules && <p className="text-sm text-[#3e4944] whitespace-pre-line mb-3">{u.rules}</p>}
            {u.facilities.length > 0 && (
              <p className="text-sm text-[#3e4944]">{u.facilities.join(" · ")}</p>
            )}
            {u.includedUtilities.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#f0eeed]">
                <p className="text-xs font-semibold text-[#12614a]">{t("unit.included")}</p>
                <p className="text-sm text-[#3e4944] mt-0.5">{u.includedUtilities.join(" · ")}</p>
              </div>
            )}
          </section>
        )}

        {/* Area */}
        {u.area && (
          <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
            <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">{t("unit.area")}</h2>
            <p className="text-sm text-[#3e4944]">
              {[
                u.area.nearest_mrt && `MRT ${u.area.nearest_mrt} (${u.area.mrt_distance ?? "—"})`,
                u.area.nearest_transjakarta && `TransJakarta ${u.area.nearest_transjakarta}`,
                u.area.nearest_minimarket && `Minimarket ${u.area.nearest_minimarket}`,
                u.area.nearest_clinic && `Klinik ${u.area.nearest_clinic}`,
                u.area.nearest_food && `Makan ${u.area.nearest_food}`,
              ].filter(Boolean).join(" · ")}
            </p>
            {u.area.area_notes ? <p className="text-sm text-[#6e7a74] mt-2">{u.area.area_notes}</p> : null}
          </section>
        )}

        {/* Assessment */}
        {u.rla && (
          <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
            <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">{t("unit.assessment")}</h2>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {SCORES.map(([k, label]) => {
                const v = (u.rla as Record<string, unknown>)[k];
                return (
                  <div key={k} className="bg-[#f6f3f2] rounded-lg p-2 text-center">
                    <p className="text-[10px] text-[#6e7a74] leading-tight">{label}</p>
                    <p className="text-base font-bold text-[#0d2137] tabular-nums">{v == null ? "—" : String(v)}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-[#12614a] mb-1">Kelebihan</p>
                <ul className="text-[#3e4944] space-y-0.5">
                  {(((u.rla.pros as string[]) ?? []).map((p, i) => <li key={i}>· {p}</li>))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#8c3a2c] mb-1">Kekurangan</p>
                <ul className="text-[#3e4944] space-y-0.5">
                  {(((u.rla.cons as string[]) ?? []).map((c, i) => <li key={i}>· {c}</li>))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Money */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
          <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">{t("unit.money")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#6e7a74]">{t("unit.paid")}</dt>
              <dd className="font-semibold text-[#0d2137] tabular-nums">{rp(u.booking.stayPaid)}</dd>
            </div>
            {u.booking.creditApplied > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-[#6e7a74]">{t("unit.creditApplied")}</dt>
                <dd className="text-[#1a7a5e] tabular-nums">{rp(u.booking.creditApplied)}</dd>
              </div>
            )}
            {u.booking.deposit > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-[#6e7a74]">{t("unit.deposit")}</dt>
                <dd className="tabular-nums">
                  {rp(u.booking.deposit)}
                  <span className="block text-xs text-[#6e7a74] text-right">
                    {u.booking.status === "completed" ? "menunggu pengembalian" : "ditahan"}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          <Link href={`/dashboard/receipts/${u.booking.id}`}
                className="inline-block mt-3 text-sm text-[#1a7a5e] font-medium hover:underline">
            {t("unit.receipt")} →
          </Link>
        </section>

        {/* Cancellation */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
          <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">{t("unit.cancellation")}</h2>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-[#3e4944]">{t("unit.refundNow")}</span>
            <span className="text-lg font-bold text-[#0d2137] tabular-nums">{rp(u.refund.amountNow)}</span>
          </div>
          <p className="text-xs text-[#6e7a74] mt-1">{u.refund.label}</p>
          {u.refund.nextChangeAt && u.refund.nextAmount !== null && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
              {t("unit.refundChanges")}{" "}
              {new Date(u.refund.nextChangeAt).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
              {" → "}{rp(u.refund.nextAmount)}
            </p>
          )}
        </section>

        {/* Contact */}
        <section className="bg-white rounded-xl border border-[#cccccc] p-5">
          <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">{t("unit.contact")}</h2>
          <p className="text-sm text-[#0d2137] font-medium">{t("unit.contactSupport")}</p>
          <Link href="/dashboard/support" className="text-sm text-[#1a7a5e] hover:underline">Hubungi dukungan →</Link>

          <div className="mt-4 pt-4 border-t border-[#f0eeed]">
            <p className="text-sm text-[#0d2137] font-medium">{t("unit.contactOwner")}</p>
            {u.ownerContact?.phone ? (
              <a href={`https://wa.me/${u.ownerContact.phone.replace(/\D/g, "")}`}
                 target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 text-sm text-[#1a7a5e] font-medium hover:underline mt-1">
                <span className="material-symbols-outlined text-base">chat</span>
                {u.ownerContact.name ?? u.ownerContact.phone}
              </a>
            ) : (
              <p className="text-xs text-[#6e7a74] mt-1">{t("unit.contactOwnerWindow")}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
