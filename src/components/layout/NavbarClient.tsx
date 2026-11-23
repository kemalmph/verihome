"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { signOut } from "@/lib/supabase/auth-actions";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { StringKey } from "@/lib/i18n/strings";

interface NavbarClientProps {
  user: { name: string; email: string } | null;
}

export function NavbarClient({ user }: NavbarClientProps) {
  const t = useT();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3">
        <LanguageToggle />

        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#e8f5f0] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#1a7a5e] flex items-center justify-center text-white text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden lg:block text-sm font-medium text-[#1b1c1c]">
                {user.name.split(" ")[0]}
              </span>
              <span className="material-symbols-outlined text-sm text-[#6e7a74]">expand_more</span>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-[#cccccc] rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#bec9c2]">
                    <p className="text-sm font-semibold text-[#1b1c1c]">{user.name}</p>
                    <p className="text-xs text-[#6e7a74] truncate">{user.email}</p>
                  </div>
                  {[
                    { href: "/dashboard", icon: "dashboard", label: "nav.dashboard" as StringKey },
                    { href: "/dashboard/saved", icon: "favorite", label: "nav.saved" as StringKey },
                    { href: "/dashboard/appointments", icon: "calendar_today", label: "nav.appointments" as StringKey },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#1b1c1c] hover:bg-[#f6f3f2] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#6e7a74]">{item.icon}</span>
                      {t(item.label)}
                    </Link>
                  ))}
                  <div className="border-t border-[#bec9c2]">
                    <form action={signOut}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        {t("nav.signOut")}
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Links, not buttons that open a modal.
             
             Both buttons used to open the same modal, and that modal always
             opened in sign-in mode — so pressing "Daftar" handed a new
             visitor a sign-in form and a small link at the bottom to find
             the real one. And being onClick, neither did anything at all
             until React had hydrated: on a phone the only account control
             in the header was dead for the first moment of a slow
             connection.
             
             /auth/login already solves both. It carries the same two tabs,
             posts without JavaScript, is translated, and honours ?next=.
             Two code paths for one job is what let the mislabelled modal
             live this long. */
          <>
            <Link
              href="/auth/login"
              className="hidden sm:block px-4 sm:px-5 py-2 rounded-lg border border-[#1a7a5e] text-[#1a7a5e] text-sm font-medium hover:bg-[#e8f5f0] transition-colors"
            >
              {t("nav.signIn")}
            </Link>
            <Link
              href="/auth/login?mode=signup"
              className="px-4 sm:px-5 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:opacity-90 transition-all shadow-sm"
            >
              {t("nav.signUp")}
            </Link>
          </>
        )}
      </div>
    </>
  );
}
