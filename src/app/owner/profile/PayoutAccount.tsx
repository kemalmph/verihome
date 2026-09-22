"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposePayoutAccount, cancelChangeRequest } from "@/lib/actions/owner-actions";
import { t } from "@/lib/i18n/strings";

interface Props {
  current: { bank: string | null; accountMasked: string; holder: string | null; verifiedAt: string | null };
  pending: { id: string; bank: string; accountMasked: string; holder: string; createdAt: string } | null;
}

export function PayoutAccount({ current, pending }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await proposePayoutAccount(new FormData(e.currentTarget));
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function cancel() {
    if (!pending) return;
    setBusy(true); setError("");
    const res = await cancelChangeRequest(pending.id);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  return (
    <section className="bg-white rounded-xl border border-[#cccccc] p-5 mb-6">
      <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
        {t("owner.profile.payout")}
      </h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[#6e7a74]">{t("owner.profile.bank")}</dt>
          <dd className="text-[#0d2137]">{current.bank ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#6e7a74]">{t("owner.profile.accountNumber")}</dt>
          <dd className="text-[#0d2137] tabular-nums font-mono">{current.accountMasked}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#6e7a74]">{t("owner.profile.accountHolder")}</dt>
          <dd className="text-[#0d2137]">{current.holder ?? "—"}</dd>
        </div>
      </dl>

      {pending && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-900">{t("owner.request.pending")}</p>
          <p className="text-xs text-amber-800 mt-1">{t("owner.profile.payoutPending")}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-amber-800">{t("owner.profile.bank")}</dt>
              <dd className="text-amber-900">{pending.bank}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-amber-800">{t("owner.profile.accountNumber")}</dt>
              <dd className="text-amber-900 font-mono">{pending.accountMasked}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-amber-800">{t("owner.profile.accountHolder")}</dt>
              <dd className="text-amber-900">{pending.holder}</dd>
            </div>
          </dl>
          <button onClick={cancel} disabled={busy}
                  className="mt-3 px-3 py-1.5 border border-amber-300 text-amber-900 text-xs font-semibold rounded-lg hover:bg-amber-100 disabled:opacity-50">
            {t("common.cancel")}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {!pending && !open && (
        <button onClick={() => setOpen(true)}
                className="mt-4 px-4 py-2 border border-[#1a7a5e] text-[#1a7a5e] text-sm font-semibold rounded-lg hover:bg-[#e8f5f0]">
          Ubah rekening
        </button>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="text-xs text-[#6e7a74]">{t("owner.profile.payoutPending")}</p>
          <input name="bank" required placeholder={t("owner.profile.bank")}
                 className="w-full h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
          <input name="account_number" required inputMode="numeric" placeholder={t("owner.profile.accountNumber")}
                 className="w-full h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
          <input name="account_holder" required placeholder={t("owner.profile.accountHolder")}
                 className="w-full h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
                    className="px-4 py-2 bg-[#1a7a5e] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              {busy ? t("common.loading") : t("common.submit")}
            </button>
            <button type="button" onClick={() => setOpen(false)}
                    className="px-4 py-2 border border-[#cccccc] text-sm font-semibold text-[#3e4944] rounded-lg hover:bg-[#f6f3f2]">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
