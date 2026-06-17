"use client";

import { useState, useTransition } from "react";
import { createAdminUser } from "@/lib/actions/user-actions";

export function CreateAdminForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const formData = new FormData(e.currentTarget);
    start(async () => {
      const res = await createAdminUser(formData);
      setResult(res);
      if (res.success) {
        (e.target as HTMLFormElement).reset();
        setTimeout(() => { setOpen(false); setResult(null); }, 1500);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[#1a7a5e] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined text-lg">person_add</span>
        Create Admin Account
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#0d2137] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1a7a5e]">admin_panel_settings</span>
          Create Admin Account
        </h3>
        <button onClick={() => { setOpen(false); setResult(null); }} className="text-[#6e7a74] hover:text-[#1b1c1c]">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {result?.error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{result.error}</div>
      )}
      {result?.success && (
        <div className="p-3 bg-[#e8f5f0] border border-[#9cf4d1] text-[#1a7a5e] text-sm rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Admin account created successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1">Full Name *</label>
            <input
              name="name"
              required
              placeholder="Budi Santoso"
              className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1">Email *</label>
            <input
              name="email"
              type="email"
              required
              placeholder="budi@verihome.id"
              className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1">Password *</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="min 8 characters"
              className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-[#6e7a74]">
          The account will be created with admin access and email confirmed immediately — no verification email needed.
        </p>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 bg-[#1a7a5e] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create Account"}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setResult(null); }}
            className="px-5 py-2 border border-[#cccccc] text-[#3e4944] rounded-lg text-sm hover:bg-[#f6f3f2]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
