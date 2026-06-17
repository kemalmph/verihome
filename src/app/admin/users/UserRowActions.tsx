"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleUserAdmin, toggleActiveClient, deleteUser } from "@/lib/actions/user-actions";

// ── Admin toggle pill ──────────────────────────────────────────────────────

export function AdminToggle({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(isAdmin);

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !current;
          const res = await toggleUserAdmin(userId, next);
          if (!res.error) setCurrent(next);
        })
      }
      title={current ? "Revoke admin access" : "Grant admin access"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        current ? "bg-[#1a7a5e]" : "bg-[#bec9c2]"
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
