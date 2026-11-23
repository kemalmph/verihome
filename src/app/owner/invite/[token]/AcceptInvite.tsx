"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptOwnerInvite } from "@/lib/actions/owner-invite-actions";
import { type StringKey } from "@/lib/i18n/strings";
import { useT } from "@/lib/i18n/LocaleProvider";

export function AcceptInvite({ token }: { token: string }) {
  const t = useT();
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
        </div>
      )}

      <button
        onClick={accept}
        disabled={busy}
        className="w-full py-3 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
      >
        {busy ? t("common.loading") : t("owner.invite.accept")}
      </button>
    </div>
  );
}
