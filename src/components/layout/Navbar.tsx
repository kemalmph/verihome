import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavbarClient } from "./NavbarClient";
import { NavFeaturesMenu } from "./NavFeaturesMenu";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

export async function Navbar() {
  const supabase = await createClient();
  const [{ data: { user } }, lang] = await Promise.all([
    supabase.auth.getUser(),
    getLocale(),
  ]);

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
              scrolled nowhere.

              The three "what does it do" links live in the Fitur dropdown.
              "Jelajahi Listing" and "Kontak Kami" are gone from here: both
              still sit in the hero, the closing banner and the footer, so
              nothing became unreachable — the header just stopped repeating
              what the page already says twice. */}
          <div className="hidden md:flex items-center gap-6">
            <NavFeaturesMenu />
            <Link
              href="/#harga"
              className="text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
            >
              {t("nav.pricing", lang)}
            </Link>
          </div>
        </div>

        <NavbarClient user={profile} />
      </nav>
    </header>
  );
}
