"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookConsultation } from "@/lib/actions/book-consultation";

const PACKAGES = {
  basic: { label: "Basic", price: "IDR 99,000", duration: "30 min" },
  premium: { label: "Premium", price: "IDR 199,000", duration: "60 min" },
} as const;

type PackageId = keyof typeof PACKAGES;

interface BookingFormProps {
  defaultPackage: PackageId;
  savedProperties: { id: string; name: string; area: string }[];
}

export function BookingForm({ defaultPackage, savedProperties }: BookingFormProps) {
  const [selectedPackage, setSelectedPackage] = useState<PackageId>(defaultPackage);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("package", selectedPackage);

    startTransition(async () => {
      const result = await bookConsultation(formData);
      if (result.error === "unauthenticated") {
        router.push("/?login=1");
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.invoiceUrl) {
        window.location.href = result.invoiceUrl;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Package selector */}
      <div>
        <p className="text-sm font-semibold text-[#1b1c1c] mb-3">Package</p>
        <div className="grid grid-cols-2 gap-4">
          {(Object.entries(PACKAGES) as [PackageId, typeof PACKAGES[PackageId]][]).map(([id, pkg]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedPackage(id)}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                selectedPackage === id
                  ? "border-[#1a7a5e] bg-[#e8f5f0]"
                  : "border-[#cccccc] bg-white hover:border-[#1a7a5e]/50"
              }`}
            >
              <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider">{pkg.label}</p>
              <p className="text-xl font-bold text-[#0d2137] mt-1">{pkg.price}</p>
              <p className="text-xs text-[#6e7a74] mt-0.5">{pkg.duration} session</p>
            </button>
          ))}
        </div>
      </div>

      {/* Property selection */}
      <div className="space-y-1">
        <label className="text-sm font-semibold text-[#1b1c1c]">
          Property to discuss <span className="text-[#6e7a74] font-normal">(optional)</span>
        </label>
        <select
          name="property_id"
          className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white"
        >
          <option value="">General consultation (no specific property)</option>
          {savedProperties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.area}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-sm font-semibold text-[#1b1c1c]">
          Questions or notes <span className="text-[#6e7a74] font-normal">(optional)</span>
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder="e.g. I'm relocating from Singapore in August, looking for a place near SCBD..."
          className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Order summary */}
      <div className="bg-[#f6f3f2] rounded-xl p-5 space-y-3 border border-[#bec9c2]">
        <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider">Order Summary</p>
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#1b1c1c]">
            {PACKAGES[selectedPackage].label} Consultation ({PACKAGES[selectedPackage].duration})
          </span>
          <span className="font-bold text-[#1a7a5e]">{PACKAGES[selectedPackage].price}</span>
        </div>
        <div className="flex justify-between items-center border-t border-[#bec9c2] pt-3">
          <span className="text-sm font-semibold text-[#1b1c1c]">Total</span>
          <span className="text-lg font-bold text-[#0d2137]">{PACKAGES[selectedPackage].price}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#1a7a5e] text-white py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            Creating payment…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">lock</span>
            Pay & Confirm Booking
          </>
        )}
      </button>
      <p className="text-xs text-center text-[#6e7a74]">
        Secured by Xendit · Your advisor will contact you within 24 hours after payment.
      </p>
    </form>
  );
}
