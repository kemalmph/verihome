"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposeRateChange } from "@/lib/actions/owner-actions";
import { t } from "@/lib/i18n/strings";

const FIELDS: [name: string, label: string][] = [
  ["price_per_night", "Tarif per malam"],
  ["price_per_week",  "Tarif per minggu"],
  ["price_per_month", "Tarif per bulan"],
  ["cleaning_fee",    "Biaya kebersihan"],
  ["min_nights",      "Minimum malam"],
];

export function ProposeRate({
  propertyId, current,
}: {
  propertyId: string;
  current: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setDone(false);
    const res = await proposeRateChange(propertyId, new FormData(e.currentTarget));
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setDone(true); setOpen(false);
    startTransition(() => router.refresh());
  }

  if (done) {
    return (
      <p className="text-sm text-[#12614a] bg-[#e8f5f0] border border-[#9cf4d1] rounded-lg px-4 py-3">
        {t("owner.request.submitted")} {t("owner.request.pending")}.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 border border-[#1a7a5e] text-[#1a7a5e] text-sm font-semibold rounded-lg hover:bg-[#e8f5f0]"
      >
        {t("owner.property.proposeRate")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-[#6e7a74] max-w-xl">{t("owner.request.rateNote")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map(([name, label]) => (
          <div key={name}>
            <label htmlFor={name} className="block text-xs font-semibold text-[#3e4944] mb-1">
              {label}
              {current?.[name] != null && (
                <span className="font-normal text-[#6e7a74]">
                  {" "}· sekarang {new Intl.NumberFormat("id-ID").format(Number(current[name]))}
                </span>
              )}
            </label>
            <input
              id={name} name={name} type="text" inputMode="numeric"
              placeholder="kosongkan jika tidak berubah"
              className="w-full h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]"
            />
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="note" className="block text-xs font-semibold text-[#3e4944] mb-1">Catatan (opsional)</label>
        <textarea
          id="note" name="note" rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[#cccccc] text-sm resize-none focus:outline-none focus:border-[#1a7a5e]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit" disabled={busy}
          className="px-4 py-2 bg-[#1a7a5e] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t("common.loading") : t("common.submit")}
        </button>
        <button
          type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 border border-[#cccccc] text-sm font-semibold text-[#3e4944] rounded-lg hover:bg-[#f6f3f2]"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
