"use client";

import Link from "next/link";
import { useRef } from "react";
import { type StringKey } from "@/lib/i18n/strings";
import { useT } from "@/lib/i18n/LocaleProvider";

const links: { href: string; icon: string; key: StringKey }[] = [
  { href: "/owner",            icon: "dashboard",   key: "owner.nav.overview" },
  { href: "/owner/properties", icon: "apartment",   key: "owner.nav.properties" },
  { href: "/owner/bookings",   icon: "hotel",       key: "owner.nav.bookings" },
  { href: "/owner/viewings",   icon: "location_on", key: "owner.nav.viewings" },
  { href: "/owner/earnings",   icon: "payments",    key: "owner.nav.earnings" },
  { href: "/owner/placements", icon: "handshake",   key: "owner.nav.placements" },
  { href: "/owner/profile",    icon: "person",      key: "owner.nav.profile" },
];

/**
 * The same drawer as the admin sidebar, for the same reason.
 *
 * It had the same defect too: a button with onClick that did nothing until
 * React hydrated, on the one screen where the menu is the only route to any
 * other page. A <details> opens without JavaScript, and the drawer sits
 * below the bar so the control that opened it can also close it.
 *
 * It also called t() with no language, so the owner portal stayed Indonesian
 * whatever the EN/ID switch said. It reads the switch now.
 */
export function OwnerSidebar({ activeHref, ownerName }: { activeHref: string; ownerName: string }) {
  const t = useT();
  const drawer = useRef<HTMLDetailsElement>(null);

  const closeDrawer = () => {
    if (drawer.current) drawer.current.open = false;
  };

  const nav = (
    <>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map((l) => {
          const active =
            activeHref === l.href ||
            (l.href !== "/owner" && activeHref.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={closeDrawer}
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
        <Link
          href="/"
          onClick={closeDrawer}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          <span>{t("owner.access.home")}</span>
        </Link>
      </div>
    </>
  );

  const header = (
    <div className="p-6 border-b border-white/10">
      <p className="text-[#9cf4d1] font-bold text-xl">Cosystem</p>
      <p className="text-white/50 text-xs mt-0.5">{t("owner.portal")}</p>
      {ownerName && (
        <p className="text-white text-sm mt-3 font-medium truncate">{ownerName}</p>
      )}
    </div>
  );

  return (
    <>
      {/* ── Phone ─────────────────────────────────────────────────────── */}
      <details ref={drawer} className="md:hidden">
        <summary
          aria-label={t("nav.menu")}
          className="list-none cursor-pointer fixed top-0 left-0 right-0 h-14 bg-[#0d2137] flex items-center px-4 z-50 gap-3 [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden className="material-symbols-outlined text-white text-xl p-1.5">
            menu
          </span>
          <p className="text-[#9cf4d1] font-bold text-lg">Cosystem</p>
          <p className="text-white/50 text-xs mt-0.5">{t("owner.short")}</p>
        </summary>

        <div
          onClick={closeDrawer}
          className="fixed top-14 left-0 right-0 bottom-0 bg-black/40 z-40"
        />

        <aside className="fixed top-14 left-0 bottom-0 w-64 bg-[#0d2137] flex flex-col z-50">
          {nav}
        </aside>
      </details>

      {/* ── Desktop ───────────────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-64 bg-[#0d2137] flex-col z-50">
        {header}
        {nav}
      </aside>
    </>
  );
}
