"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOwnerRequest, rejectOwnerRequest } from "@/lib/actions/owner-request-actions";
import { t } from "@/lib/i18n/strings";

export function RequestActions({ requestId, needsPhoneCheck }: { requestId: string; needsPhoneCheck: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [, startTransition] = useTransition();

  async function run(fn: (id: string, note?: string) => Promise<{ error?: string }>) {
    setBusy(true); setError("");
    const res = await fn(requestId, note || undefined);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#f0eeed] space-y-3">
      {needsPhoneCheck && (
        <label className="flex items-start gap-2.5 bg-[#fbeeec] border border-[#e2b3ab] rounded-lg p-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                 className="mt-0.5 w-4 h-4 accent-[#8c3a2c] shrink-0" />
          <span className="text-sm text-[#8c3a2c]">
            Saya sudah menelepon pemilik dan memastikan perubahan ini benar dari mereka.
          </span>
        </label>
      )}

      <input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
        className="w-full h-9 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => run(approveOwnerRequest)}
          disabled={busy || (needsPhoneCheck && !confirmed)}
          className="px-4 py-2 bg-[#1a7a5e] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("admin.requests.approve")}
        </button>
        <button
          onClick={() => run(rejectOwnerRequest)}
          disabled={busy}
          className="px-4 py-2 border border-red-200 text-red-600 bg-red-50 text-sm font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50"
        >
          {t("admin.requests.reject")}
        </button>
      </div>
    </div>
  );
}
