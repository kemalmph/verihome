import Link from "next/link";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

export const dynamic = "force-dynamic";

function statusBadge(status: BookingStatus) {
  const map: Record<BookingStatus, string> = {
    pending:   "bg-amber-100 text-amber-700",
    confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    completed: "bg-[#e8f5f0] text-[#1a7a5e]",
    expired:   "bg-gray-200 text-gray-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function paymentBadge(ps: PaymentStatus) {
  const map: Record<PaymentStatus, string> = {
    unpaid:               "bg-red-100 text-red-700",
    pending_verification: "bg-amber-100 text-amber-700",
    paid:                 "bg-green-100 text-green-700",
    refunded:             "bg-blue-100 text-blue-700",
  };
  return map[ps] ?? "bg-gray-100 text-gray-600";
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default async function DashboardBookingsPage() {
  const user  = await getCurrentUser();
  const admin = createAdminClient();

  const { data: bookings } = await admin
    .from("bookings")
    .select(`
      id, booking_code, check_in_date, check_out_date, nights, guests,
      total_price, status, payment_status, bank_transfer_code, created_at,
      property:properties ( id, name, area, slug )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/bookings" userName={user.name} isActiveClient={user.is_active_client} />

      <main className="flex-1 ml-72 p-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-[#0d2137] mb-1">My Bookings</h2>
          <p className="text-[#3e4944]">Short-stay bookings you&apos;ve made through VeriHome.</p>
        </header>

        {!bookings || bookings.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-[#e8f5f0] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-[#1a7a5e] text-4xl">hotel</span>
            </div>
            <h3 className="text-xl font-semibold text-[#1b1c1c] mb-2">No bookings yet</h3>
            <p className="text-[#3e4944] mb-6">
              Browse short-stay listings and make your first booking.
            </p>
            <Link
              href="/listings"
              className="inline-block bg-[#1a7a5e] text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => {
              const property = (b.property as unknown) as { id: string; name: string; area: string; slug: string } | null;
              return (
                <div key={b.id} className="bg-white rounded-xl border border-[#cccccc] p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#0d2137] text-lg">{property?.name ?? "—"}</span>
                        <span className="text-xs text-[#6e7a74]">{property?.area}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge(b.status as BookingStatus)}`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="text-sm text-[#3e4944]">
                        {b.check_in_date} → {b.check_out_date} · {b.nights} nights · {b.guests} guest{b.guests > 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-[#6e7a74]">Booking code: <strong>{b.booking_code}</strong></div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-xl font-bold text-[#1a7a5e]">IDR {fmt(Number(b.total_price))}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${paymentBadge(b.payment_status as PaymentStatus)}`}>
                        {b.payment_status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Payment instructions for unpaid bookings */}
                  {b.payment_status === "unpaid" && b.bank_transfer_code && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                      <p className="font-semibold text-amber-800 mb-1">Payment required</p>
                      <p className="text-amber-700">
                        Transfer with unique code <strong>{b.bank_transfer_code}</strong> appended to your total.
                        Upload proof below.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex gap-3 flex-wrap">
                    {property?.slug && (
                      <Link
                        href={`/listings/${property.slug}`}
                        className="text-sm text-[#1a7a5e] hover:underline"
                      >
                        View listing →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
