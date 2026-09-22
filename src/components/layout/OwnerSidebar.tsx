"use client";

import Link from "next/link";
import { useState } from "react";
import { t, type StringKey } from "@/lib/i18n/strings";

const links: { href: string; icon: string; key: StringKey }[] = [
  { href: "/owner",            icon: "dashboard",   key: "owner.nav.overview" },
  { href: "/owner/properties", icon: "apartment",   key: "owner.nav.properties" },
  { href: "/owner/bookings",   icon: "hotel",       key: "owner.nav.bookings" },
  { href: "/owner/viewings",   icon: "location_on", key: "owner.nav.viewings" },
  { href: "/owner/earnings",   icon: "payments",    key: "owner.nav.earnings" },
  { href: "/owner/placements", icon: "handshake",   key: "owner.nav.placements" },
  { href: "/owner/profile",    icon: "person",      key: "owner.nav.profile" },
];

export function OwnerSidebar({ activeHref, ownerName }: { activeHref: string; ownerName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0d2137] flex items-center px-4 z-50 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-white p-1.5 rounded-md hover:bg-white/10"
          aria-label="Buka menu"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
        </button>
        <p className="text-[#9cf4d1] font-bold text-lg">VeriHome</p>
        <p className="text-white/50 text-xs mt-0.5">Pemilik</p>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-50" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-[#0d2137] z-50 flex flex-col transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-white/10">
          <p className="text-[#9cf4d1] font-bold text-xl">VeriHome</p>
          <p className="text-white/50 text-xs mt-0.5">Portal Pemilik</p>
          {ownerName && (
            <p className="text-white text-sm mt-3 font-medium truncate">{ownerName}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map((l) => {
            const active =
              activeHref === l.href ||
              (l.href !== "/owner" && activeHref.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-[#1a7a5e] text-white font-semibold" : "text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-xl">{l.icon}</span>
                <span>{t(l.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10">
            <span className="material-symbols-outlined text-xl">logout</span>
            <span>Kembali ke situs</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
