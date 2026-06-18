"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "@/lib/actions/user-actions";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone_whatsapp: string | null;
  user_type: string | null;
  preferred_area: string | null;
  budget_min: number | null;
  budget_max: number | null;
}

export function EditUserButton({ user }: { user: User }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit user"
        className="text-[#6e7a74] hover:text-[#1a7a5e] transition-colors"
      >
        <span className="material-symbols-outlined text-base">edit</span>
      </button>

      {open && <EditUserModal user={user} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateUser(user.id, formData);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8e8e8]">
          <h2 className="text-lg font-bold text-[#0d2137] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1a7a5e]">manage_accounts</span>
            Edit User
          </h2>
          <button onClick={onClose} className="text-[#6e7a74] hover:text-[#1b1c1c] transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">Full Name</label>
              <input
                name="name"
                defaultValue={user.name ?? ""}
                placeholder="Full name"
                className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={user.email ?? ""}
                placeholder="email@example.com"
                className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">WhatsApp</label>
              <input
                name="phone_whatsapp"
                defaultValue={user.phone_whatsapp ?? ""}
                placeholder="+62 812 3456 7890"
                className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">User Type</label>
              <select
                name="user_type"
                defaultValue={user.user_type ?? ""}
                className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white"
              >
                <option value="">— Select type —</option>
                <option value="renter">Renter</option>
                <option value="owner">Owner</option>
                <option value="agent">Agent</option>
                <option value="expat">Expat</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">Preferred Area</label>
              <input
                name="preferred_area"
                defaultValue={user.preferred_area ?? ""}
                placeholder="e.g. Kemang, SCBD"
                className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">Budget Min (IDR)</label>
              <input
                name="budget_min"
                type="number"
                defaultValue={user.budget_min ?? ""}
                placeholder="e.g. 5000000"
                className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">Budget Max (IDR)</label>
              <input
                name="budget_max"
                type="number"
                defaultValue={user.budget_max ?? ""}
                placeholder="e.g. 15000000"
                className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 bg-[#1a7a5e] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {pending ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-[#cccccc] text-[#3e4944] rounded-lg text-sm hover:bg-[#f6f3f2] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
