import { redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";
import { requireOwner } from "@/lib/auth/guards";
import { ownerBookings } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "menunggu",  cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "terkonfirmasi", cls: "bg-[#e8f5f0] text-[#12614a]" },
  completed: { label: "selesai",   cls: "bg-blue-50 text-blue-800" },
  cancelled: { label: "dibatalkan", cls: "bg-red-100 text-red-700" },
  expired:   { label: "kedaluwarsa", cls: "bg-gray-200 text-gray-600" },
};

export default async function OwnerBookingsPage() {
  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }
  const bookings = await ownerBookings();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <OwnerSidebar activeHref="/owner/bookings" ownerName={owner.ownerName} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 max-w-3xl">
        <h1 className="text-3xl font-bold text-[#0d2137]">{t("owner.bookings.title")}</h1>
        <p className="text-xs text-[#6e7a74] mt-2 mb-6 max-w-2xl">{t("owner.bookings.privacyNote")}</p>

        {bookings.length === 0 ? (
          <p className="text-[#3e4944]">{t("owner.bookings.none")}</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const s = STATUS[b.status] ?? { label: b.status, cls: "bg-gray-100 text-gray-600" };
              return (
                <article key={b.id} className="bg-white rounded-xl border border-[#cccccc] p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0d2137]">{b.propertyName}</p>
                      <p className="text-sm text-[#3e4944] mt-0.5">{day(b.checkIn)} → {day(b.checkOut)}</p>
                      <p className="text-xs text-[#6e7a74] mt-1">
                        {b.nights} malam · {b.guests} tamu · {t("owner.bookings.guest")}: {b.guestFirstName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
                      <p className="text-sm font-bold text-[#1a7a5e] mt-2 tabular-nums">{rp(b.toOwner)}</p>
                      <p className="text-[11px] text-[#6e7a74]">{t("owner.bookings.toYou")}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#f0eeed]">
                    {b.contactOpen && b.guestPhone ? (
                      <a href={`https://wa.me/${b.guestPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1.5 text-sm text-[#1a7a5e] font-medium hover:underline">
                        <span className="material-symbols-outlined text-base">chat</span>
                        {b.guestPhone}
                      </a>
                    ) : (
                      <p className="text-[11px] text-[#6e7a74]">{t("owner.bookings.contactWindow")}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
