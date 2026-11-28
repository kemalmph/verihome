import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { isStaffRole, type StaffRole } from "@/lib/auth/permissions";
import { RoleToggles, ActiveClientToggle, DeleteUserButton } from "./UserRowActions";
import { CreateAdminForm } from "./CreateAdminForm";
import { CreateUserForm } from "./CreateUserForm";
import { EditUserButton } from "./EditUserModal";

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
  const viewer = await requirePermissionOrRedirect(["users.manage", "staff.manage"]);
  const canEditRoles = viewer.permissions.includes("staff.manage");
  const { tab } = await searchParams;
  // The "Staff roles" view is the menu entry for staff.manage. Without it the
  // link is not shown, and typing the URL goes back to the plain list rather
  // than relying on the missing link.
  if (tab === "admins" && !canEditRoles) redirect("/admin/users");
  const activeTab: TabValue = (TABS.find((t) => t.value === tab)?.value ?? "all");

  const admin = createAdminClient();

  const { data: users } = await admin
    .from("users")
    .select("id, name, email, phone_whatsapp, user_type, preferred_area, budget_min, budget_max, is_active_client, created_at")
    .order("created_at", { ascending: false });

  const { data: roleRows } = await admin.from("staff_roles").select("user_id, role");
  const rolesByUser = new Map<string, StaffRole[]>();
  for (const r of roleRows ?? []) {
    if (!isStaffRole(r.role)) continue;
    rolesByUser.set(r.user_id as string, [...(rolesByUser.get(r.user_id as string) ?? []), r.role]);
  }

  const all = users ?? [];
  const admins   = all.filter((u) => rolesByUser.has(u.id));
  const clients  = all.filter((u) => !rolesByUser.has(u.id));
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
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref={activeTab === "admins" ? "/admin/users?tab=admins" : "/admin/users"} />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ink">Users</h1>
            <p className="text-ink-2 mt-1">
              {all.length} total · {admins.length} admins · {active.length} active clients
            </p>
          </div>
          {activeTab === "admins"  && canEditRoles && <CreateAdminForm />}
          {activeTab === "clients" && <CreateUserForm />}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.filter((t) => t.value !== "admins" || canEditRoles).map((t) => (
            <a
              key={t.value}
              href={t.value === "all" ? "/admin/users" : `/admin/users?tab=${t.value}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                activeTab === t.value
                  ? "bg-white border-brand text-brand-ink shadow-sm"
                  : "bg-white border-line-strong text-ink-2 hover:border-brand"
              }`}
            >
              {t.label}
              <span className="ml-2 px-1.5 py-0.5 bg-canvas rounded text-xs font-bold text-ink-3">
                {counts[t.value]}
              </span>
            </a>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-canvas border-b border-line-strong">
                <th className="text-left px-6 py-4 text-xs font-bold text-ink-2 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-ink-2 uppercase tracking-wider">Contact</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-ink-2 uppercase tracking-wider">Type</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-ink-2 uppercase tracking-wider">Staff roles</th>
                {showActiveClientCol && (
                  <th className="text-center px-6 py-4 text-xs font-bold text-ink-2 uppercase tracking-wider">Active Client</th>
                )}
                <th className="text-left px-6 py-4 text-xs font-bold text-ink-2 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-strong">
              {displayed.map((u) => {
                const joined = new Date(u.created_at).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <tr key={u.id} className="hover:bg-canvas transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink text-sm">{u.name ?? "—"}</p>
                      <p className="text-xs text-ink-3">{u.email ?? "—"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink">{u.phone_whatsapp ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-canvas text-ink-2 capitalize">
                        {u.user_type ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <RoleToggles userId={u.id} roles={rolesByUser.get(u.id) ?? []} canEdit={canEditRoles} />
                      </div>
                    </td>
                    {showActiveClientCol && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <ActiveClientToggle userId={u.id} isActive={u.is_active_client ?? false} />
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-xs text-ink-3">{joined}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <EditUserButton user={{
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          phone_whatsapp: u.phone_whatsapp,
                          user_type: u.user_type,
                          preferred_area: u.preferred_area,
                          budget_min: u.budget_min,
                          budget_max: u.budget_max,
                        }} />
                        <DeleteUserButton userId={u.id} userName={u.name ?? u.email ?? u.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={showActiveClientCol ? 8 : 7} className="px-6 py-12 text-center text-sm text-ink-3">
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
