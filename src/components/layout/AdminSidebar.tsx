import Link from "next/link";

interface AdminSidebarProps {
  activeHref: string;
}

const links = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/listings", icon: "apartment", label: "Listings" },
  { href: "/admin/consultations", icon: "calendar_today", label: "Consultations" },
  { href: "/admin/surveys/pending", icon: "assignment", label: "Survey Imports" },
];

export function AdminSidebar({ activeHref }: AdminSidebarProps) {
  return (
    <aside className="w-64 bg-[#0d2137] text-white flex flex-col fixed h-full z-40">
      <div className="px-6 py-8">
        <p className="text-[#9cf4d1] font-bold text-xl">VeriHome</p>
        <p className="text-white/50 text-xs mt-1">Admin Panel</p>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {links.map((link) => {
          const active = activeHref === link.href || (link.href !== "/admin" && activeHref.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                active
                  ? "text-[#80d7b6] bg-white/5"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{link.icon}</span>
              <span className="text-sm font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-6 border-t border-white/10">
        <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white text-xs transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to site
        </Link>
      </div>
    </aside>
  );
}
