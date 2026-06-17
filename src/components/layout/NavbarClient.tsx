"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { LoginModal } from "@/components/auth/LoginModal";
import { signOut } from "@/lib/supabase/auth-actions";

interface NavbarClientProps {
  user: { name: string; email: string } | null;
}

export function NavbarClient({ user }: NavbarClientProps) {
  const [showModal, setShowModal] = useState(false);
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
                    { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
                    { href: "/dashboard/saved", icon: "favorite", label: "Saved Listings" },
                    { href: "/dashboard/appointments", icon: "calendar_today", label: "Appointments" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#1b1c1c] hover:bg-[#f6f3f2] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#6e7a74]">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                  <div className="border-t border-[#bec9c2]">
                    <form action={signOut}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        Sign Out
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowModal(true)}
              className="hidden lg:block px-5 py-2 rounded-lg border border-[#1a7a5e] text-[#1a7a5e] text-sm font-medium hover:bg-[#e8f5f0] transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:opacity-90 transition-all shadow-sm"
            >
              Sign Up
            </button>
          </>
        )}
      </div>

      {showModal && <LoginModal onClose={() => setShowModal(false)} />}
    </>
  );
}
