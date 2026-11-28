"use client";

import { useState, useTransition } from "react";
import { createAdminUser } from "@/lib/actions/user-actions";

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const formData = new FormData(e.currentTarget);
    // An ordinary user: never send a role. The server grants staff access only
    // when a role is sent explicitly, so this form cannot create staff.
    formData.delete("role");
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
        className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined text-lg">person_add</span>
        Add New User
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-line shadow-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-ink">person_add</span>
          Add New User
        </h3>
        <button onClick={() => { setOpen(false); setResult(null); }} className="text-ink-3 hover:text-ink">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {result?.error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{result.error}</div>
      )}
      {result?.success && (
        <div className="p-3 bg-brand-soft border border-brand-light text-brand-ink text-sm rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          User created successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider block mb-1">Full Name *</label>
            <input
              name="name"
              required
              placeholder="Jane Smith"
              className="w-full h-11 px-3 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider block mb-1">Email *</label>
            <input
              name="email"
              type="email"
              required
              placeholder="jane@example.com"
              className="w-full h-11 px-3 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider block mb-1">Password *</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="min 8 characters"
              className="w-full h-11 px-3 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-ink-3">
          Account will be created without admin access and email confirmed immediately.
        </p>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create User"}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setResult(null); }}
            className="px-5 py-2 border border-line-strong text-ink-2 rounded-lg text-sm hover:bg-canvas"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
