"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { grantStaffRole, revokeStaffRole, toggleActiveClient, deleteUser } from "@/lib/actions/user-actions";
import { STAFF_ROLES, type StaffRole } from "@/lib/auth/permissions";

// ── Staff role chips ───────────────────────────────────────────────────────

const ROLE_LABEL: Record<StaffRole, string> = {
  superadmin: "Superadmin",
  admin_general: "General",
  admin_listings: "Listings",
  admin_finance: "Finance",
  surveyor: "Surveyor",
};

/** Read-only unless canEdit (staff.manage). The server enforces it either way. */
export function RoleToggles({ userId, roles, canEdit }: { userId: string; roles: StaffRole[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState<StaffRole[]>(roles);
  const [error, setError] = useState("");

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1 justify-center max-w-[220px]">
        {STAFF_ROLES.map((role) => {
          const on = current.includes(role);
          if (!canEdit && !on) return null;
          return (
            <button
              key={role}
              type="button"
              disabled={pending || !canEdit}
              onClick={() =>
                start(async () => {
                  const res = on ? await revokeStaffRole(userId, role) : await grantStaffRole(userId, role);
                  if (res.error) { setError(res.error); return; }
                  setError("");
                  setCurrent(on ? current.filter((r) => r !== role) : [...current, role]);
                })
              }
              title={canEdit ? (on ? `Revoke ${ROLE_LABEL[role]}` : `Grant ${ROLE_LABEL[role]}`) : ROLE_LABEL[role]}
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border disabled:opacity-60 ${
                on ? "bg-[#1a7a5e] text-white border-[#1a7a5e]" : "bg-white text-[#6e7a74] border-[#bec9c2]"
              }`}
            >
              {ROLE_LABEL[role]}
            </button>
          );
        })}
        {!canEdit && current.length === 0 && <span className="text-xs text-[#6e7a74]">—</span>}
      </div>
      {error && <span className="text-[10px] text-red-600 max-w-[200px] leading-tight">{error}</span>}
    </div>
  );
}

// ── Active client toggle ───────────────────────────────────────────────────

export function ActiveClientToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(isActive);

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !current;
          const res = await toggleActiveClient(userId, next);
          if (!res.error) setCurrent(next);
        })
      }
      title={current ? "Deactivate client" : "Mark as active client"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        current ? "bg-[#3b82f6]" : "bg-[#bec9c2]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          current ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ── Delete user button ─────────────────────────────────────────────────────

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
        start(async () => {
          await deleteUser(userId);
          router.refresh();
        });
      }}
      title="Delete user"
      className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
    >
      {pending ? (
        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
      ) : (
        <span className="material-symbols-outlined text-base">delete</span>
      )}
    </button>
  );
}
