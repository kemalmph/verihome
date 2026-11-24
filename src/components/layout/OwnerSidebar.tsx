"use client";

import Link from "next/link";
import { useRef } from "react";
import { type StringKey } from "@/lib/i18n/strings";
import { useT } from "@/lib/i18n/LocaleProvider";
import { SidebarCollapseToggle } from "./SidebarCollapseToggle";

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

  // `rail` marks the desktop copy; see AdminSidebar for why the phone
  // drawer's copy must not carry the collapsed: classes.
  const renderNav = (rail: boolean) => {
    const r = (cls: string) => (rail ? cls : "");
    return (
      <>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {links.map((l) => {
            const active =
              activeHref === l.href ||
              (l.href !== "/owner" && activeHref.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={closeDrawer}
                title={rail ? t(l.key) : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${r("collapsed:justify-center collapsed:px-0")} ${
                  active ? "bg-[#1a7a5e] text-white font-semibold" : "text-white/70 hover:bg-white/10"
                }`}
              >
                <span aria-hidden className="material-symbols-outlined text-xl">{l.icon}</span>
                <span className={`whitespace-nowrap ${r("collapsed:sr-only")}`}>{t(l.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          {rail && (
            <SidebarCollapseToggle
              collapseLabel={t("nav.sidebarCollapse")}
              expandLabel={t("nav.sidebarExpand")}
            />
          )}
          <Link
            href="/"
            onClick={closeDrawer}
            title={rail ? t("owner.access.home") : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 ${r("collapsed:justify-center collapsed:px-0")}`}
          >
            <span aria-hidden className="material-symbols-outlined text-xl">logout</span>
            <span className={`whitespace-nowrap ${r("collapsed:sr-only")}`}>{t("owner.access.home")}</span>
          </Link>
        </div>
      </>
    );
  };

  const header = (
    <div className="p-6 border-b border-white/10 whitespace-nowrap collapsed:px-0 collapsed:text-center">
      <p className="text-[#9cf4d1] font-bold text-xl collapsed:hidden">Cosystem</p>
      <p aria-hidden className="text-[#9cf4d1] font-bold text-xl hidden collapsed:block">C</p>
      <p className="text-white/50 text-xs mt-0.5 collapsed:hidden">{t("owner.portal")}</p>
      {ownerName && (
        <p className="text-white text-sm mt-3 font-medium truncate collapsed:hidden">{ownerName}</p>
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
          {renderNav(false)}
        </aside>
      </details>

      {/* ── Desktop ───────────────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-(--sidebar-w) transition-[width] bg-[#0d2137] flex-col z-50 overflow-hidden">
        {header}
        {renderNav(true)}
      </aside>
    </>
  );
}
