"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOwnerInvite, setOwnerPortalAccess } from "@/lib/actions/owner-invite-actions";
import { t } from "@/lib/i18n/strings";

interface Props {
  ownerId: string;
  ownerName: string;
  portalAccess: "none" | "invited" | "active" | "revoked";
  hasWhatsApp: boolean;
}

const BADGE: Record<string, { label: string; cls: string }> = {
  none:    { label: "belum diundang", cls: "bg-gray-100 text-gray-600" },
  invited: { label: "diundang",       cls: "bg-amber-100 text-amber-800" },
  active:  { label: "aktif",          cls: "bg-[#e8f5f0] text-[#12614a]" },
  revoked: { label: "dicabut",        cls: "bg-red-100 text-red-700" },
};

export function OwnerPortalControls({ ownerId, ownerName, portalAccess, hasWhatsApp }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState<{ url: string; whatsappUrl: string | null; expiresAt: string } | null>(null);
  const [, startTransition] = useTransition();

  const badge = BADGE[portalAccess] ?? BADGE.none;

  async function invitee() {
    setBusy(true); setError(""); setCopied(false);
    const res = await createOwnerInvite(ownerId);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setInvite(res.invite ?? null);
    startTransition(() => router.refresh());
  }

  async function setAccess(access: "active" | "revoked") {
    setBusy(true); setError("");
    const res = await setOwnerPortalAccess(ownerId, access);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
          {badge.label}
        </span>

        {portalAccess !== "revoked" && (
          <button
            onClick={invitee}
            disabled={busy}
            className="px-3 py-1.5 border border-[#1a7a5e] text-[#1a7a5e] text-xs font-semibold rounded-lg hover:bg-[#e8f5f0] disabled:opacity-50"
          >
            {portalAccess === "none" ? t("admin.owner.invite") : t("admin.owner.reinvite")}
          </button>
        )}

        {portalAccess === "active" && (
          <button
            onClick={() => setAccess("revoked")}
            disabled={busy}
            className="px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            {t("admin.owner.revoke")}
          </button>
        )}

        {portalAccess === "revoked" && (
          <button
            onClick={() => setAccess("active")}
            disabled={busy}
            className="px-3 py-1.5 border border-[#1a7a5e] text-[#1a7a5e] text-xs font-semibold rounded-lg hover:bg-[#e8f5f0] disabled:opacity-50"
          >
            Pulihkan akses
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {invite && (
        <div className="bg-[#e8f5f0] border border-[#9cf4d1] rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-[#12614a]">{t("admin.owner.inviteCreated")}</p>

          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-white rounded px-2 py-1.5 break-all text-[#0d2137]">
              {invite.url}
            </code>
            <button
              onClick={() => { navigator.clipboard?.writeText(invite.url); setCopied(true); }}
              className="px-2 py-1.5 bg-white border border-[#cccccc] rounded text-xs font-semibold shrink-0"
            >
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>

          {invite.whatsappUrl ? (
            <a
              href={invite.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-semibold rounded-lg hover:opacity-90"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              Kirim lewat WhatsApp
            </a>
          ) : (
            <p className="text-xs text-amber-800">
              {ownerName} belum punya nomor WhatsApp — salin tautan dan kirim manual.
            </p>
          )}

          <p className="text-[11px] text-[#3e4944]">
            Sekali pakai, berlaku sampai{" "}
            {new Date(invite.expiresAt).toLocaleDateString("id-ID", {
              day: "numeric", month: "long", year: "numeric",
            })}
            . Tautan ini tidak dapat ditampilkan lagi setelah halaman ditutup.
          </p>
        </div>
      )}

      {!invite && !hasWhatsApp && portalAccess === "none" && (
        <p className="text-[11px] text-[#6e7a74]">Tanpa nomor WhatsApp, tautan harus dikirim manual.</p>
      )}
    </div>
  );
}
