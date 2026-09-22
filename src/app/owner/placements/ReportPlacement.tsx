"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reportPlacement } from "@/lib/actions/owner-actions";
import { t } from "@/lib/i18n/strings";

export function ReportPlacement({ properties }: { properties: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  if (properties.length === 0) {
    return <p className="text-sm text-[#6e7a74]">Belum ada properti.</p>;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setDone(false);
    const res = await reportPlacement(new FormData(e.currentTarget));
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setDone(true);
    (e.target as HTMLFormElement).reset();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {done && (
        <p className="text-sm text-[#12614a] bg-[#e8f5f0] border border-[#9cf4d1] rounded-lg px-4 py-2.5">
          {t("owner.request.submitted")}
        </p>
      )}

      <select name="property_id" required
              className="w-full h-10 px-3 rounded-lg border border-[#cccccc] text-sm bg-white focus:outline-none focus:border-[#1a7a5e]">
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input name="tenant_first_name" required placeholder={t("owner.placements.tenantFirstName")}
               className="h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
        <input name="monthly_rent" required inputMode="numeric" placeholder={t("owner.placements.monthlyRent")}
               className="h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
        <input name="lease_start" type="date" aria-label={t("owner.placements.leaseStart")}
               className="h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={busy}
              className="px-4 py-2 bg-[#1a7a5e] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
        {busy ? t("common.loading") : t("common.submit")}
      </button>
    </form>
  );
}
