"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookConsultation } from "@/lib/actions/book-consultation";
import type { PaymentAction } from "@/lib/payment";
import { useT } from "@/lib/i18n/LocaleProvider";

type BankTransfer = Extract<PaymentAction, { kind: "bank_transfer" }>;

const PACKAGES = {
  basic: { label: "Basic", price: 99000, duration: "30 min" },
  premium: { label: "Premium", price: 199000, duration: "60 min" },
} as const;

const rp = (n: number) => `IDR ${n.toLocaleString("id-ID")}`;

type PackageId = keyof typeof PACKAGES;

interface BookingFormProps {
  defaultPackage: PackageId;
  savedProperties: { id: string; name: string; area: string }[];
  /** Spendable credit. Display only — the server recomputes what applies. */
  availableCredit: number;
}

export function BookingForm({ defaultPackage, savedProperties, availableCredit }: BookingFormProps) {
  const t = useT();
  const [selectedPackage, setSelectedPackage] = useState<PackageId>(defaultPackage);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<BankTransfer | null>(null);
  const [useCredit, setUseCredit] = useState(availableCredit > 0);
  const [covered, setCovered] = useState<{ creditApplied: number } | null>(null);

  // A preview only. The server applies whole credits oldest-first inside a lock
  // and returns the real figure — this must never be sent as an amount.
  const price = PACKAGES[selectedPackage].price;
  const estimatedCredit = useCredit ? Math.min(availableCredit, price) : 0;
  const estimatedDue = price - estimatedCredit;
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
      // Credit covered the whole price, so there is no transfer to make and no
      // payment screen to show.
      if (result.fullyCovered) {
        setCovered({ creditApplied: result.creditApplied ?? 0 });
        return;
      }

      const action = result.intent?.action;
      if (!action) return;

      // A redirecting provider hands the payer to a hosted checkout; a bank
      // transfer keeps them here and shows the details to pay against.
      if (action.kind === "redirect") {
        window.location.href = action.checkoutUrl;
        return;
      }
      setTransfer(action);
    });
  }

  if (covered) {
    return (
      <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-brand-ink text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          <div>
            <h2 className="font-bold text-ink text-lg">{t("cf.paidWithCredit")}</h2>
            <p className="text-sm text-ink-3">{t("cf.paidWithCreditSub")}</p>
          </div>
        </div>

        <div className="bg-success-soft border border-success-line rounded-lg p-4 text-sm text-success-ink">
          {t("cf.creditUsed")} <strong>{rp(covered.creditApplied)}</strong>
          <span className="block text-xs text-ink-2 mt-1">{t("cf.contact24")}</span>
        </div>

        <button
          onClick={() => router.push("/dashboard/appointments")}
          className="w-full py-3 bg-ink text-white rounded-lg text-sm font-semibold hover:opacity-90"
        >
          {t("cf.viewAppointments")}
        </button>
      </div>
    );
  }

  if (transfer) {
    return (
      <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-brand-ink text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          <div>
            <h2 className="font-bold text-ink text-lg">{t("cf.reserved")}</h2>
            <p className="text-sm text-ink-3">{t("cf.reservedSub")}</p>
          </div>
        </div>

        <div className="bg-[#f6f3f2] rounded-lg p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-ink-3">{t("view.bank")}</span><strong>{transfer.bankName}</strong></div>
            <div className="flex justify-between"><span className="text-ink-3">{t("view.account")}</span><strong>{transfer.accountNumber}</strong></div>
            <div className="flex justify-between"><span className="text-ink-3">{t("view.accountName")}</span><strong>{transfer.accountHolder}</strong></div>
            <div className="flex justify-between text-brand-ink font-bold border-t border-[#cccccc] pt-2 mt-2">
              <span>{t("view.transferExactly")}</span>
              <span>IDR {transfer.payableAmount.toLocaleString("id-ID")}</span>
            </div>
          </div>
          <p className="text-xs text-ink-3">{transfer.instructions}</p>
        </div>

        <p className="text-xs text-ink-3">
          {t("cf.confirmNote")}
        </p>

        <button
          onClick={() => router.push("/dashboard/appointments")}
          className="w-full py-3 bg-ink text-white rounded-lg text-sm font-semibold hover:opacity-90"
        >
          {t("cf.viewAppointments")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Package selector */}
      <div>
        <p className="text-sm font-semibold text-ink mb-3">{t("cf.package")}</p>
        <div className="grid grid-cols-2 gap-4">
          {(Object.entries(PACKAGES) as [PackageId, typeof PACKAGES[PackageId]][]).map(([id, pkg]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedPackage(id)}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                selectedPackage === id
                  ? "border-brand bg-brand-soft"
                  : "border-[#cccccc] bg-white hover:border-brand/50"
              }`}
            >
              <p className="text-xs font-bold text-ink-2 uppercase tracking-wider">{pkg.label}</p>
              <p className="text-xl font-bold text-ink mt-1">{rp(pkg.price)}</p>
              <p className="text-xs text-ink-3 mt-0.5">{pkg.duration} {t("cf.session")}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Property selection */}
      <div className="space-y-1">
        <label className="text-sm font-semibold text-ink">
          {t("cf.propertyToDiscuss")} <span className="text-ink-3 font-normal">{t("cf.optional")}</span>
        </label>
        <select
          name="property_id"
          className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-brand focus:outline-none text-sm bg-white"
        >
          <option value="">{t("cf.generalConsult")}</option>
          {savedProperties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.area}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-sm font-semibold text-ink">
          {t("cf.questions")} <span className="text-ink-3 font-normal">{t("cf.optional")}</span>
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder={t("cf.questionsPh")}
          className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-brand focus:outline-none text-sm resize-none"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Credit */}
      {availableCredit > 0 && (
        <label className="flex items-start gap-3 bg-brand-soft border border-brand-light rounded-xl p-4 cursor-pointer">
          <input
            type="checkbox"
            name="use_credit"
            checked={useCredit}
            onChange={(e) => setUseCredit(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-brand shrink-0"
          />
          <span className="text-sm text-success-ink">
            {t("cf.useCredit")} <strong>{rp(availableCredit)}</strong> {t("cf.available")}
            <span className="block text-xs text-ink-2 mt-0.5">{t("cf.creditOrder")}</span>
          </span>
        </label>
      )}

      {/* Order summary */}
      <div className="bg-[#f6f3f2] rounded-xl p-5 space-y-3 border border-line-strong">
        <p className="text-xs font-bold text-ink-2 uppercase tracking-wider">{t("cf.orderSummary")}</p>
        <div className="flex justify-between items-center">
          <span className="text-sm text-ink">
            {PACKAGES[selectedPackage].label} {t("cf.consultation")} ({PACKAGES[selectedPackage].duration})
          </span>
          <span className="font-bold text-brand-ink">{rp(price)}</span>
        </div>

        {estimatedCredit > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-ink">{t("cf.cosystemCredit")}</span>
            <span className="font-bold text-brand-ink">− {rp(estimatedCredit)}</span>
          </div>
        )}

        <div className="flex justify-between items-center border-t border-line-strong pt-3">
          <span className="text-sm font-semibold text-ink">{t("cf.total")}</span>
          <span className="text-lg font-bold text-ink">{rp(estimatedDue)}</span>
        </div>

        {estimatedCredit > 0 && (
          <p className="text-xs text-ink-3">
            {t("cf.recomputed")}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand text-white py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            {t("cf.creating")}
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">lock</span>
            {t("cf.payConfirm")}
          </>
        )}
      </button>
      <p className="text-xs text-center text-ink-3">
        {t("cf.footnote")}
      </p>
    </form>
  );
}
