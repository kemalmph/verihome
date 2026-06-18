import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminToggle, ActiveClientToggle, DeleteUserButton } from "./UserRowActions";
import { CreateAdminForm } from "./CreateAdminForm";
import { CreateUserForm } from "./CreateUserForm";

interface AdminUsersPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export const dynamic = "force-dynamic";

const TABS = [
  { value: "all",      label: "All Users" },
  { value: "clients",  label: "Non-admin" },
  { value: "active",   label: "Active Clients" },
  { value: "admins",   label: "Admin Accounts" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const { tab } = await searchParams;
  const activeTab: TabValue = (TABS.find((t) => t.value === tab)?.value ?? "all");

  const admin = createAdminClient();

  const { data: users } = await admin
    .from("users")
    .select("id, name, email, phone_whatsapp, user_type, is_admin, is_active_client, created_at")
    .order("created_at", { ascending: false });

  const all = users ?? [];
  const admins   = all.filter((u) => u.is_admin);
  const clients  = all.filter((u) => !u.is_admin);
  const active   = all.filter((u) => u.is_active_client);

  const counts: Record<TabValue, number> = {
    all:     all.length,
    clients: clients.length,
    active:  active.length,
    admins:  admins.length,
  };

  const displayed =
    activeTab === "admins"  ? admins  :
    activeTab === "clients" ? clients :
    activeTab === "active"  ? active  : all;

  const showActiveClientCol = activeTab !== "admins";

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/users" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2137]">Users</h1>
            <p className="text-[#3e4944] mt-1">
              {all.length} total · {admins.length} admins · {active.length} active clients
            </p>
          </div>
          {activeTab === "admins"  && <CreateAdminForm />}
          {activeTab === "clients" && <CreateUserForm />}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <a
              key={t.value}
              href={t.value === "all" ? "/admin/users" : `/admin/users?tab=${t.value}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                activeTab === t.value
                  ? "bg-white border-[#1a7a5e] text-[#1a7a5e] shadow-sm"
                  : "bg-white border-[#cccccc] text-[#3e4944] hover:border-[#1a7a5e]"
              }`}
            >
              {t.label}
              <span className="ml-2 px-1.5 py-0.5 bg-[#f6f3f2] rounded text-xs font-bold text-[#6e7a74]">
                {counts[t.value]}
              </span>
            </a>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f3f2] border-b border-[#bec9c2]">
                <th className="text-left px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">Contact</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">Type</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">Admin</th>
                {showActiveClientCol && (
                  <th className="text-center px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">Active Client</th>
                )}
                <th className="text-left px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bec9c2]">
              {displayed.map((u) => {
                const joined = new Date(u.created_at).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <tr key={u.id} className="hover:bg-[#f6f3f2] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#0d2137] text-sm">{u.name ?? "—"}</p>
                      <p className="text-xs text-[#6e7a74]">{u.email ?? "—"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#1b1c1c]">{u.phone_whatsapp ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f6f3f2] text-[#3e4944] capitalize">
                        {u.user_type ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <AdminToggle userId={u.id} isAdmin={u.is_admin ?? false} />
                      </div>
                    </td>
                    {showActiveClientCol && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <ActiveClientToggle userId={u.id} isActive={u.is_active_client ?? false} />
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-xs text-[#6e7a74]">{joined}</td>
                    <td className="px-6 py-4">
                      <DeleteUserButton userId={u.id} userName={u.name ?? u.email ?? u.id} />
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={showActiveClientCol ? 7 : 6} className="px-6 py-12 text-center text-sm text-[#6e7a74]">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
