import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingStatusActions } from "./BookingStatusActions";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

export const dynamic = "force-dynamic";

function statusColor(s: BookingStatus) {
  const m: Record<BookingStatus, string> = {
    pending:   "bg-amber-100 text-amber-700",
    confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    completed: "bg-brand-soft text-brand-ink",
    // Muted, not red: an expiry is the deadline passing, not a cancellation.
    expired:   "bg-gray-200 text-gray-600",
  };
  return m[s] ?? "bg-gray-100 text-gray-700";
}

function paymentColor(ps: PaymentStatus) {
  const m: Record<PaymentStatus, string> = {
    unpaid:               "bg-red-100 text-red-700",
    pending_verification: "bg-amber-100 text-amber-700",
    paid:                 "bg-green-100 text-green-700",
    refunded:             "bg-blue-100 text-blue-700",
  };
  return m[ps] ?? "bg-gray-100 text-gray-700";
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default async function AdminBookingsPage() {
  await requirePermissionOrRedirect(["bookings.operate", "payments.settle", "finance.view"]);
  const admin = createAdminClient();

  const { data: bookings } = await admin
    .from("bookings")
    .select(`
      id, booking_code, check_in_date, check_out_date, nights, guests,
      total_price, status, payment_status, payment_proof_url, bank_transfer_code,
      admin_notes, created_at,
      property:properties ( id, name, area ),
      user:users ( id, name, email, phone_whatsapp )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AppSidebar activeHref="/admin/bookings" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">Bookings</h1>
          <p className="text-ink-3 text-sm mt-1">All short-stay booking requests</p>
        </div>

        {!bookings || bookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#cccccc] p-12 text-center">
            <span className="material-symbols-outlined text-[#cccccc] text-5xl">hotel</span>
            <p className="text-ink-3 mt-4">No bookings yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => {
              const property = (b.property as unknown) as { id: string; name: string; area: string } | null;
              const user     = (b.user     as unknown) as { id: string; name: string; email: string; phone_whatsapp: string | null } | null;
              return (
                <div key={b.id} className="bg-white rounded-xl border border-[#cccccc] p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink">{property?.name ?? "—"}</span>
                        <span className="text-xs text-ink-3">{property?.area}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(b.status as BookingStatus)}`}>
                          {b.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentColor(b.payment_status as PaymentStatus)}`}>
                          {b.payment_status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-sm text-ink-2">
                        {b.check_in_date} → {b.check_out_date} · {b.nights}n · {b.guests} guests
                      </div>
                      <div className="text-xs text-ink-3">
                        Code: <strong>{b.booking_code}</strong> ·
                        Guest: <strong>{user?.name ?? "—"}</strong> ({user?.email ?? "—"})
                        {user?.phone_whatsapp && ` · WA: ${user.phone_whatsapp}`}
                      </div>
                      <div className="text-xs text-ink-3">
                        Transfer code: <strong>{b.bank_transfer_code ?? "—"}</strong>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold text-brand-ink mb-1">IDR {fmt(Number(b.total_price))}</div>
                      {b.payment_proof_url && (
                        <a
                          href={b.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-ink hover:underline"
                        >
                          View proof →
                        </a>
                      )}
                    </div>
                  </div>

                  <BookingStatusActions
                    bookingId={b.id}
                    currentStatus={b.status as BookingStatus}
                    currentPaymentStatus={b.payment_status as PaymentStatus}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
