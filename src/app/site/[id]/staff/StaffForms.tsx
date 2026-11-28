"use client";

import { useActionState } from "react";
import {
  inviteSiteStaffForm, revokeSiteStaffInviteForm, revokeSiteStaffRoleForm,
} from "@/lib/actions/site-staff-actions";
import { SITE_ROLE_LABELS, type SiteRole } from "@/lib/auth/site-permissions";
import { pill } from "@/components/brand/styles";

/*
 * Plain <form action> with useActionState: the forms submit and the result
 * renders before hydration too (no onClick doing the work).
 */

const inputCls =
  "w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

export function InviteForm({ siteId, roles }: { siteId: string; roles: SiteRole[] }) {
  const [state, action, pending] = useActionState(inviteSiteStaffForm, null);

  return (
    <form action={action} className="bg-white rounded-2xl border border-line shadow-card p-6">
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink mb-1">Undang staf</h2>
      <p className="text-sm text-ink-3 mb-5">
        Email belum terhubung: Anda menerima tautan untuk dikirim sendiri, misalnya lewat WhatsApp.
        Yang diundang harus masuk dengan email yang sama.
      </p>
      <input type="hidden" name="site_id" value={siteId} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="block text-xs font-semibold text-ink-3 mb-1.5">Email</span>
          <input name="email" type="email" required className={inputCls} placeholder="nama@contoh.com" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ink-3 mb-1.5">Peran</span>
          <select name="role" required defaultValue="" className={inputCls}>
            <option value="" disabled>Pilih peran…</option>
            {roles.map((r) => <option key={r} value={r}>{SITE_ROLE_LABELS[r]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ink-3 mb-1.5">No. WhatsApp (opsional)</span>
          <input name="phone" inputMode="tel" className={inputCls} placeholder="62812…" />
        </label>
      </div>

      {state?.error && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</p>
      )}
      {state?.invite && (
        <div className="mt-4 rounded-2xl bg-brand-soft border border-brand-light p-4 text-sm">
          <p className="font-semibold text-ink">Undangan dibuat. Tautan ini hanya tampil sekali.</p>
          <p className="mt-2 break-all font-mono text-xs text-ink-2" data-invite-url>{state.invite.url}</p>
          <a href={state.invite.whatsappUrl} target="_blank" rel="noreferrer" className={`${pill.primarySm} mt-3`}>
            Kirim lewat WhatsApp
          </a>
        </div>
      )}

      <button type="submit" disabled={pending} className={`${pill.primarySm} mt-5`}>
        {pending ? "Membuat…" : "Buat undangan"}
      </button>
    </form>
  );
}

export function RevokeRoleButton({ siteId, userId, role }: { siteId: string; userId: string; role: SiteRole }) {
  const [state, action, pending] = useActionState(revokeSiteStaffRoleForm, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="role" value={role} />
      <button type="submit" disabled={pending} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">
        Cabut
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(revokeSiteStaffInviteForm, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="invite_id" value={inviteId} />
      <button type="submit" disabled={pending} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">
        Batalkan
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
