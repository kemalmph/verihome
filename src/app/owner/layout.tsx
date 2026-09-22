import type { ReactNode } from "react";

/**
 * Display only.
 *
 * This layout does NOT protect anything. It cannot: a layout gates rendering a
 * page, and every page and action beneath it is separately reachable. The
 * actual boundary is requireOwner() inside each page and each server action,
 * which re-reads portal_access on every call — see §18.6 of the system
 * reference, where seven server actions relied on exactly this kind of layout
 * and were reachable by any signed-in user.
 *
 * The invite page lives under /owner too and is deliberately outside the
 * portal's audience: it is how someone who is not yet an owner becomes one.
 */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f6f3f2]">{children}</div>;
}
