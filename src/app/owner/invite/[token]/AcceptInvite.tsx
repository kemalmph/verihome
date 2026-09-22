"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptOwnerInvite } from "@/lib/actions/owner-invite-actions";
import { t, type StringKey } from "@/lib/i18n/strings";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<StringKey | null>(null);

  async function accept() {
    setBusy(true); setErrorKey(null);
    const res = await acceptOwnerInvite(token);
    setBusy(false);

    if (res?.error === "unauthenticated") {
      router.push(`/auth/login?next=${encodeURIComponent(`/owner/invite/${token}`)}`);
      return;
    }
    if (res?.error) { setErrorKey(res.error as StringKey); return; }
    router.push("/owner");
  }

  return (
    <div className="space-y-4">
      {errorKey && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{t(errorKey)}</p>
          <p className="text-xs text-red-600 mt-1">{t(errorKey, "en")}</p>
        </div>
      )}

      <button
        onClick={accept}
        disabled={busy}
        className="w-full py-3 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
      >
        {busy ? t("common.loading") : t("owner.invite.accept")}
      </button>
      <p className="text-xs text-center text-[#6e7a74]">{t("owner.invite.accept", "en")}</p>
    </div>
  );
}
