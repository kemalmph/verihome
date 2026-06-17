"use client";

import { useState, useTransition } from "react";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendOtp,
  verifyOtp,
} from "@/lib/supabase/auth-actions";

type Tab = "email" | "google" | "whatsapp";
type EmailMode = "signin" | "signup";

interface LoginModalProps {
  onClose: () => void;
}

export function LoginModal({ onClose }: LoginModalProps) {
  const [tab, setTab] = useState<Tab>("email");
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [otpSent, setOtpSent] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
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

  function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await sendOtp(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result?.success) {
        setOtpPhone(result.phone);
        setOtpSent(true);
      }
    });
  }

  function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("phone", otpPhone);
    setMessage(null);
    startTransition(async () => {
      const result = await verifyOtp(formData);
      if (result?.error) setMessage({ type: "error", text: result.error });
    });
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "email", label: "Email", icon: "mail" },
    { id: "google", label: "Google", icon: "language" },
    { id: "whatsapp", label: "WhatsApp", icon: "phone_iphone" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#0d2137] px-8 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <p className="text-[#9cf4d1] font-bold text-lg">VeriHome</p>
          <h2 className="text-2xl font-bold mt-1">Sign in to continue</h2>
          <p className="text-white/60 text-sm mt-1">
            Access saved listings and consultations.
          </p>
        </div>

        <div className="p-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-[#f6f3f2] rounded-xl p-1 mb-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setMessage(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-white text-[#0d2137] shadow-sm"
                    : "text-[#3e4944] hover:text-[#1b1c1c]"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

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

          {/* Email Tab */}
          {tab === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {emailMode === "signup" && (
                <div>
                  <label className="text-xs font-medium text-[#3e4944] block mb-1">Full Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Sarah Chen"
                    className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-[#3e4944] block mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#3e4944] block mb-1">Password</label>
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
                {isPending ? "Loading…" : emailMode === "signin" ? "Sign In" : "Create Account"}
              </button>
              <p className="text-center text-sm text-[#3e4944]">
                {emailMode === "signin" ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => setEmailMode(emailMode === "signin" ? "signup" : "signin")}
                  className="text-[#1a7a5e] font-bold hover:underline"
                >
                  {emailMode === "signin" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </form>
          )}

          {/* Google Tab */}
          {tab === "google" && (
            <div className="space-y-4">
              <p className="text-sm text-[#3e4944] text-center">
                Continue with your Google account. Fast and secure.
              </p>
              <form action={signInWithGoogle}>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-12 border-2 border-[#cccccc] rounded-xl font-semibold text-[#0d2137] flex items-center justify-center gap-3 hover:border-[#1a7a5e] hover:bg-[#e8f5f0] transition-all disabled:opacity-50"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </form>
            </div>
          )}

          {/* WhatsApp OTP Tab */}
          {tab === "whatsapp" && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <p className="text-sm text-[#3e4944]">
                    Enter your Indonesian phone number. We&apos;ll send a one-time code via SMS.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-[#3e4944] block mb-1">Phone Number</label>
                    <div className="flex">
                      <span className="h-11 px-3 flex items-center bg-[#f6f3f2] border border-r-0 border-[#bec9c2] rounded-l-lg text-sm text-[#3e4944] font-medium">
                        +62
                      </span>
                      <input
                        name="phone"
                        type="tel"
                        required
                        placeholder="812 3456 7890"
                        className="flex-1 h-11 border border-[#bec9c2] rounded-r-lg px-3 text-sm focus:outline-none focus:border-[#1a7a5e]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-11 bg-[#25D366] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">chat</span>
                    {isPending ? "Sending…" : "Send OTP via SMS"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <p className="text-sm text-[#3e4944]">
                    Enter the 6-digit code sent to <strong>{otpPhone}</strong>.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-[#3e4944] block mb-1">OTP Code</label>
                    <input
                      name="token"
                      type="text"
                      required
                      maxLength={6}
                      placeholder="123456"
                      className="w-full h-11 border border-[#bec9c2] rounded-lg px-3 text-sm text-center tracking-[0.5em] font-bold focus:outline-none focus:border-[#1a7a5e]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-11 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {isPending ? "Verifying…" : "Verify & Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setMessage(null); }}
                    className="w-full text-center text-sm text-[#3e4944] hover:text-[#1a7a5e]"
                  >
                    ← Change phone number
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
