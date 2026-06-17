import Link from "next/link";

interface SidebarLink {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

const mainLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/dashboard/saved", label: "Saved Listings", icon: "favorite" },
  { href: "/dashboard/appointments", label: "Appointments", icon: "calendar_today", badge: 1 },
  { href: "/dashboard/viewings", label: "Viewings", icon: "location_on" },
  { href: "/dashboard/support", label: "Support & Services", icon: "headset_mic" },
];

interface DashboardSidebarProps {
  activeHref?: string;
  userName?: string;
  isActiveClient?: boolean;
}

export function DashboardSidebar({
  activeHref = "/dashboard",
  userName = "User",
  isActiveClient = false,
}: DashboardSidebarProps) {
  return (
    <aside className="w-72 bg-[#0d2137] text-white flex flex-col fixed h-full z-40">
      <div className="px-8 py-10">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-[#9cf4d1]">
          VeriHome
        </Link>
      </div>

      <div className="px-8 mb-8">
        <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="w-10 h-10 rounded-full bg-[#1a7a5e] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{userName}</p>
            {isActiveClient && (
              <span className="inline-block px-2 py-0.5 mt-1 rounded-full text-[10px] font-bold bg-[#1a7a5e] text-white uppercase tracking-wider">
                Active Client
              </span>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {mainLinks.map((link) => {
          const isActive = activeHref === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between px-4 py-3 rounded-md transition-colors ${
                isActive
                  ? "text-[#80d7b6] bg-white/5"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-[20px]">
                  {link.icon}
                </span>
                <span className="text-sm font-medium">{link.label}</span>
              </div>
              {link.badge && (
                <span className="bg-[#1a7a5e] text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full">
                  {link.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-6 pb-2 px-4">
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
            Account
          </p>
        </div>

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-4 px-4 py-3 rounded-md text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-sm font-medium">Profile Settings</span>
        </Link>
      </nav>

      <div className="p-4 mt-auto">
        <Link
          href="/auth/login"
          className="flex items-center gap-4 px-4 py-3 rounded-md text-red-300/60 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="text-sm font-medium">Logout</span>
        </Link>
      </div>
    </aside>
  );
}
