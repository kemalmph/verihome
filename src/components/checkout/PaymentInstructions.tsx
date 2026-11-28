"use client";

import { useT } from "@/lib/i18n/LocaleProvider";
import type { StringKey } from "@/lib/i18n/strings";
import type { PaymentIntent } from "@/lib/payment/types";
import { pill } from "@/components/brand/styles";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

/**
 * What the guest does next to pay, shared by the booking and viewing flows.
 *
 * It reads the PaymentIntent exactly as /api/bookings and /api/viewings
 * return it: the details live under `intent.action`, a union on `kind`
 * (lib/payment/types.ts). Both flows used to read flat fields —
 * intent.bankName, intent.totalAmount + intent.transferCode — that the
 * provider abstraction stopped sending, so the payment step showed
 * "IDR NaN" and an empty bank account.
 *
 * The amount is the server's `payableAmount` (amount + kode unik), not
 * recomputed here: matching is manual and by exact amount (Reference §7,
 * §11), so the figure the guest sees must be the one the server stored.
 */
export function PaymentInstructions({ intent, title }: { intent: PaymentIntent; title: StringKey }) {
  const t = useT();
  const action = intent.action;

  if (action.kind === "redirect") {
    return (
      <div className="rounded-2xl border border-line bg-white px-5 py-5 space-y-4">
        <p className="text-sm font-bold text-ink">{t(title)}</p>
        <p className="text-[28px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">
          IDR {fmt(intent.amount)}
        </p>
        <a href={action.checkoutUrl} className={`${pill.primary} w-full`}>
          {t(title)} <span aria-hidden>→</span>
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line overflow-hidden">
      <div className="bg-brand-soft px-5 py-4">
        <p className="text-xs font-semibold text-brand-ink">{t("view.transferExactly")}</p>
        <p className="mt-1 text-[28px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">
          IDR {fmt(action.payableAmount)}
        </p>
      </div>
      <div className="px-5 py-4 space-y-3 bg-white">
        <p className="text-sm font-bold text-ink">{t(title)}</p>
        <dl className="space-y-2 text-sm">
          {[
            { k: t("view.bank"), v: action.bankName },
            { k: t("view.account"), v: action.accountNumber },
            { k: t("view.accountName"), v: action.accountHolder },
          ].map((row) => (
            <div key={row.k} className="flex justify-between gap-4">
              <dt className="text-ink-3">{row.k}</dt>
              <dd className="font-semibold text-ink text-right tabular-nums">{row.v || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ink-3 leading-relaxed">{action.instructions}</p>
      </div>
    </div>
  );
}
