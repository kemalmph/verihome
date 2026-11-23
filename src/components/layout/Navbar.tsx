import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavbarClient } from "./NavbarClient";

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const profile = user
    ? {
        name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
        email: user.email ?? "",
      }
    : null;

  return (
    <header className="bg-[#fbf9f8] sticky top-0 z-50 border-b border-[#bec9c2] shadow-sm">
      <nav className="flex justify-between items-center w-full px-4 md:px-16 h-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold text-[#006048]">
            Cosystem
          </Link>
          {/* Anchors point at section ids that exist on the homepage —
              #cara-kerja and #harga. The previous menu linked #how-it-works
              and #neighborhoods, and neither id survived the rewrite, so both
              scrolled nowhere. */}
          <div className="hidden md:flex items-center gap-6">
            {[
              { href: "/#fitur-kelola", label: "Fitur Kelola" },
              { href: "/#monetisasi", label: "Cara Monetisasi" },
              { href: "/#workspace-hunian", label: "Workspace & Hunian" },
              { href: "/#harga", label: "Harga" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/listings"
              className="text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
            >
              Jelajahi Listing
            </Link>
            <Link
              href="/contact"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#1a7a5e] text-white hover:bg-[#166750] transition-colors"
            >
              Kontak Kami
            </Link>
          </div>
        </div>

        <NavbarClient user={profile} />
      </nav>
    </header>
  );
}
