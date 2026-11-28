"use client";

import { useActionState } from "react";
import { acceptSiteStaffInvite } from "@/lib/actions/site-staff-actions";
import { pill } from "@/components/brand/styles";

export function AcceptSiteInvite({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptSiteStaffInvite, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700" data-invite-error>{state.error}</p>
        </div>
      )}
      <button type="submit" disabled={pending} className={`${pill.primary} w-full`}>
        {pending ? "Memproses…" : "Terima undangan"}
      </button>
    </form>
  );
}
