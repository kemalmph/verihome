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
            VeriHome
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/listings"
              className="text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
            >
              Listings
            </Link>
            <Link
              href="/#how-it-works"
              className="text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="/#neighborhoods"
              className="text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
            >
              Neighborhoods
            </Link>
            <Link
              href="/list-your-property"
              className="text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
            >
              List Your Property
            </Link>
          </div>
        </div>

        <NavbarClient user={profile} />
      </nav>
    </header>
  );
}
