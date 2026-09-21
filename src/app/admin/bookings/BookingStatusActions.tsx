"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

interface Props {
  bookingId:            string;
  currentStatus:        BookingStatus;
  currentPaymentStatus: PaymentStatus;
}

export function BookingStatusActions({ bookingId, currentStatus, currentPaymentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function update(patch: Record<string, string>) {
    setError("");
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Update failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  // "paid" belongs here too. Marking a booking paid used to clear the only
  // condition that showed this button, so a booking confirmed that way had no
  // way out of 'pending'. The server now confirms on payment, but a booking
  // already stranded still needs a button to escape.
  const canConfirm  = currentStatus === "pending"   &&
    (currentPaymentStatus === "pending_verification" || currentPaymentStatus === "paid");
  const canCancel   = currentStatus !== "cancelled"  && currentStatus !== "completed";
  const canMarkPaid = currentPaymentStatus !== "paid" && currentStatus !== "cancelled";

  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap border-t border-[#f6f3f2] pt-3">
      {canMarkPaid && (
        <button
          disabled={isPending}
          onClick={() => update({ payment_status: "paid" })}
          className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          Mark paid
        </button>
      )}
      {canConfirm && (
        <button
          disabled={isPending}
          onClick={() => update({ status: "confirmed", payment_status: "paid" })}
          className="px-3 py-1.5 bg-[#1a7a5e] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          Confirm booking
        </button>
      )}
      {canCancel && (
        <button
          disabled={isPending}
          onClick={() => update({ status: "cancelled" })}
          className="px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
