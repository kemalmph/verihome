"use client";

import { useState, useTransition } from "react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from "@/lib/supabase/auth-actions";
import { useT } from "@/lib/i18n/LocaleProvider";

const input =
  "w-full h-11 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light/40 text-sm bg-white";
const labelCls = "text-xs font-semibold text-ink-2 uppercase tracking-wider block mb-1";

type Mode = "signin" | "signup";

export function LoginForm({ next, reason, initialMode = "signin", googleEnabled = false }: {
  next: string; reason?: string; initialMode?: Mode; googleEnabled?: boolean;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(initialMode);
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
      const res = await signUpWithEmail(formData, next || "/dashboard");
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
    <div className="bg-white rounded-2xl border border-line-strong shadow-sm overflow-hidden">
      <div className="flex border-b border-line">
        {([["signin", t("login.tabSignIn")], ["signup", t("login.tabSignUp")]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              mode === value
                ? "text-brand-ink border-b-2 border-brand -mb-px"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-7">
        {reason && !error && !notice && (
          <div className="mb-5 flex items-start gap-2 bg-success-soft border border-success-line rounded-lg px-4 py-3 text-sm text-success-ink">
            <span className="material-symbols-outlined text-brand-ink text-base">info</span>
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
          <div className="mb-5 flex items-start gap-2 bg-success-soft border border-success-line rounded-lg px-4 py-3 text-sm text-success-ink">
            <span className="material-symbols-outlined text-brand-ink text-base">mark_email_unread</span>
            {notice}
          </div>
        )}

        {/* method="post" supaya submit sebelum hidrasi tidak menaruh
        password di query string. Tanpa ini, default HTML adalah GET:
        klik cepat di koneksi lambat mengirim email dan password ke URL,
        lalu ke riwayat browser, log server, dan header Referer.
        Setelah hidrasi, onSubmit mencegah submit asli dan method tidak
        lagi berperan — ini murni jaring pengaman untuk jendela sebelum
        JavaScript siap. */}
        <form method="post" onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className={labelCls} htmlFor="name">{t("login.fullName")}</label>
              <input id="name" name="name" required placeholder={t("login.fullNamePh")} className={input} />
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="email">{t("login.email")}</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              placeholder="you@example.com" className={input} />
          </div>

          <div>
            <label className={labelCls} htmlFor="password">{t("login.password")}</label>
            <input
              id="password" name="password" type="password" required minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? t("login.passwordPh") : "••••••••"}
              className={input}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-brand text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {isPending ? (
              <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                {mode === "signin" ? t("login.signingIn") : t("login.creating")}</>
            ) : (
              mode === "signin" ? t("login.tabSignIn") : t("login.tabSignUp")
            )}
          </button>
        </form>

        {/* Hidden until the Google provider is enabled in Supabase — an OAuth
            button that errors on click is worse than no button at all. */}
        {googleEnabled && (
          <>
            <div className="flex items-center gap-3 my-5">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-3">{t("login.or")}</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <form action={signInWithGoogle.bind(null, next)}>
              <button
                type="submit"
                className="w-full h-11 border border-line-strong rounded-lg font-semibold text-sm text-ink-2 hover:border-brand transition-colors"
              >
                {t("login.google")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
