"use client";

import { useState, useTransition } from "react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from "@/lib/supabase/auth-actions";

const input =
  "w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white";
const labelCls = "text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1";

type Mode = "signin" | "signup";

export function LoginForm({ next, reason }: { next: string; reason?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (mode === "signin") {
        // Redirects on success, so nothing comes back in the happy path.
        const res = await signInWithEmail(formData, next);
        if (res?.error) setError(res.error);
        return;
      }
      // Redirects straight to `next` when the account is usable immediately;
      // only returns when confirmation is still required.
      const res = await signUpWithEmail(formData, next);
      if (res?.error)   { setError(res.error); return; }
      if (res?.success) { setNotice(res.success); }
    });
  }

  function switchMode(to: Mode) {
    setMode(to);
    setError("");
    setNotice("");
  }

  return (
    <div className="bg-white rounded-2xl border border-[#cccccc] shadow-sm overflow-hidden">
      <div className="flex border-b border-[#e4e2e1]">
        {([["signin", "Sign in"], ["signup", "Create account"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              mode === value
                ? "text-[#1a7a5e] border-b-2 border-[#1a7a5e] -mb-px"
                : "text-[#6e7a74] hover:text-[#3e4944]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-7">
        {reason && !error && !notice && (
          <div className="mb-5 flex items-start gap-2 bg-[#e8f5f0] border border-[#9cf4d1] rounded-lg px-4 py-3 text-sm text-[#12614a]">
            <span className="material-symbols-outlined text-[#1a7a5e] text-base">info</span>
            {reason}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <span className="material-symbols-outlined text-red-500 text-base">error</span>
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-start gap-2 bg-[#e8f5f0] border border-[#9cf4d1] rounded-lg px-4 py-3 text-sm text-[#12614a]">
            <span className="material-symbols-outlined text-[#1a7a5e] text-base">mark_email_unread</span>
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className={labelCls} htmlFor="name">Full name</label>
              <input id="name" name="name" required placeholder="Your name" className={input} />
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              placeholder="you@example.com" className={input} />
          </div>

          <div>
            <label className={labelCls} htmlFor="password">Password</label>
            <input
              id="password" name="password" type="password" required minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              className={input}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {isPending ? (
              <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                {mode === "signin" ? "Signing in…" : "Creating account…"}</>
            ) : (
              mode === "signin" ? "Sign in" : "Create account"
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <span className="h-px flex-1 bg-[#e4e2e1]" />
          <span className="text-xs text-[#6e7a74]">or</span>
          <span className="h-px flex-1 bg-[#e4e2e1]" />
        </div>

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full h-11 border border-[#cccccc] rounded-lg font-semibold text-sm text-[#3e4944] hover:border-[#1a7a5e] transition-colors"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
