import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConsultationStatusSelect } from "./ConsultationStatusSelect";

export default async function AdminConsultationsPage() {
  await requirePermissionOrRedirect(["bookings.operate"]);
  const admin = createAdminClient();

  const { data: consultations } = await admin
    .from("consultations")
    .select("id, package_type, price, status, notes, scheduled_at, created_at, users(name, email)")
    .order("created_at", { ascending: false });

  const STATUS_COLORS: Record<string, string> = {
    pending_payment: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref="/admin/consultations" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-ink">Consultations</h1>
          <p className="text-ink-2 mt-1">{consultations?.length ?? 0} total</p>
        </header>

        <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-canvas border-b border-line-strong">
                {["User", "Package", "Price", "Status", "Notes", "Booked", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-bold text-ink-2 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-strong">
              {(consultations ?? []).map((c) => {
                const user = c.users as unknown as { name: string; email: string } | null;
                const price = new Intl.NumberFormat("id-ID").format(c.price ?? 0);
                const booked = new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                return (
                  <tr key={c.id} className="hover:bg-canvas transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-sm text-ink">{user?.name ?? "—"}</p>
                      <p className="text-xs text-ink-3 truncate max-w-[140px]">{user?.email ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4 text-sm capitalize text-ink">{c.package_type}</td>
                    <td className="px-5 py-4 text-sm font-medium text-brand-ink">IDR {price}</td>
                    <td className="px-5 py-4">
                      <ConsultationStatusSelect consultationId={c.id} currentStatus={c.status ?? "pending_payment"} statusColors={STATUS_COLORS} />
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-3 max-w-[160px] truncate">{c.notes ?? "—"}</td>
                    <td className="px-5 py-4 text-xs text-ink-3">{booked}</td>
                    <td className="px-5 py-4 text-xs text-ink-2">
                      {c.id.slice(0, 8)}…
                    </td>
                  </tr>
                );
              })}
              {(consultations ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-ink-3">
                    No consultations yet.
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
