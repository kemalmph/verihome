"use client";

import { useState, useTransition } from "react";
import { signInWithEmail } from "@/lib/supabase/auth-actions";

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await signInWithEmail(formData, "/admin");
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-[#0d2137] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-[#0d2137] px-8 py-6 text-white">
          <p className="text-[#9cf4d1] font-bold text-lg">VeriHome</p>
          <h1 className="text-2xl font-bold mt-1">Admin Access</h1>
          <p className="text-white/60 text-sm mt-1">Restricted to authorized staff only.</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#3e4944] block mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="admin@verihome.id"
                className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#3e4944] block mb-1">Password</label>
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-11 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
