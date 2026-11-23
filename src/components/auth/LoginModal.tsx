"use client";

import { useState, useTransition } from "react";
import {
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/supabase/auth-actions";
import { useT } from "@/lib/i18n/LocaleProvider";

type EmailMode = "signin" | "signup";

interface LoginModalProps {
  onClose: () => void;
}

export function LoginModal({ onClose }: LoginModalProps) {
  const t = useT();
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const action = emailMode === "signin" ? signInWithEmail : signUpWithEmail;
      const result = await action(formData);
      if (result?.error) setMessage({ type: "error", text: result.error });
      else if ("success" in result && result.success) setMessage({ type: "success", text: result.success as string });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#0d2137] px-8 py-6 text-white">
          <button
            onClick={onClose}
            aria-label={t("modal.close")}
            className="absolute top-4 right-4 text-white/60 hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <p className="text-[#9cf4d1] font-bold text-lg">Cosystem</p>
          <h2 className="text-2xl font-bold mt-1">{t("modal.title")}</h2>
          <p className="text-white/60 text-sm mt-1">
            {t("modal.sub")}
          </p>
        </div>

        <div className="p-8">
          {/* Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === "error"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-[#e8f5f0] text-[#1a7a5e] border border-[#9cf4d1]"
            }`}>
              {message.text}
            </div>
          )}

          {/* method="post" supaya submit sebelum hidrasi tidak menaruh
          password di query string. Tanpa ini, default HTML adalah GET:
          klik cepat di koneksi lambat mengirim email dan password ke URL,
          lalu ke riwayat browser, log server, dan header Referer.
          Setelah hidrasi, onSubmit mencegah submit asli dan method tidak
          lagi berperan — ini murni jaring pengaman untuk jendela sebelum
          JavaScript siap. */}
          <form method="post" onSubmit={handleEmailSubmit} className="space-y-4">
            {emailMode === "signup" && (
              <div>
                <label className="text-xs font-medium text-[#3e4944] block mb-1">{t("login.fullName")}</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder={t("login.fullNamePh")}
                  className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-[#3e4944] block mb-1">{t("login.email")}</label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#3e4944] block mb-1">{t("login.password")}</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-11 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? t("modal.loading") : emailMode === "signin" ? t("login.tabSignIn") : t("login.tabSignUp")}
            </button>
            <p className="text-center text-sm text-[#3e4944]">
              {emailMode === "signin" ? t("modal.noAccount") : t("modal.hasAccount")}{" "}
              <button
                type="button"
                onClick={() => { setEmailMode(emailMode === "signin" ? "signup" : "signin"); setMessage(null); }}
                className="text-[#1a7a5e] font-bold hover:underline"
              >
                {emailMode === "signin" ? t("login.tabSignUp") : t("login.tabSignIn")}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
