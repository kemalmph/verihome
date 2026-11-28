import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavbarClient } from "./NavbarClient";
import { NavDropdown } from "./NavDropdown";
import { NavMobileMenu } from "./NavMobileMenu";
import { PUBLIC_NAV } from "./nav-items";
import { Logo } from "@/components/brand/Logo";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

/**
 * The public header (prototype V7): wordmark, four menu entries, then the
 * account controls. Sticky, white with a slight blur over the hero.
 */
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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/5">
      <nav className="flex items-center justify-between gap-6 w-full max-w-[1160px] mx-auto px-4 md:px-6 h-[66px] md:h-[76px]">
        <Link href="/" aria-label="Cosystem" className="shrink-0">
          <Logo height={24} priority />
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {PUBLIC_NAV.map((entry) =>
            entry.kind === "link" ? (
              <Link
                key={entry.label}
                href={entry.href}
                className="text-sm font-semibold text-ink-2 hover:text-ink transition-colors"
              >
                {t(entry.label, lang)}
              </Link>
            ) : (
              <NavDropdown key={entry.label} label={entry.label} items={entry.items} />
            ),
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NavbarClient user={profile} />
          <NavMobileMenu lang={lang} />
        </div>
      </nav>
    </header>
  );
}
