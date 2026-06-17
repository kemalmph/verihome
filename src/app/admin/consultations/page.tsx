import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConsultationStatusSelect } from "./ConsultationStatusSelect";

export default async function AdminConsultationsPage() {
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
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/consultations" />
      <main className="flex-1 ml-64 p-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">Consultations</h1>
          <p className="text-[#3e4944] mt-1">{consultations?.length ?? 0} total</p>
        </header>

        <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f3f2] border-b border-[#bec9c2]">
                {["User", "Package", "Price", "Status", "Notes", "Booked", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bec9c2]">
              {(consultations ?? []).map((c) => {
                const user = c.users as unknown as { name: string; email: string } | null;
                const price = new Intl.NumberFormat("id-ID").format(c.price ?? 0);
                const booked = new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                return (
                  <tr key={c.id} className="hover:bg-[#f6f3f2] transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-sm text-[#0d2137]">{user?.name ?? "—"}</p>
                      <p className="text-xs text-[#6e7a74] truncate max-w-[140px]">{user?.email ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4 text-sm capitalize text-[#1b1c1c]">{c.package_type}</td>
                    <td className="px-5 py-4 text-sm font-medium text-[#1a7a5e]">IDR {price}</td>
                    <td className="px-5 py-4">
                      <ConsultationStatusSelect consultationId={c.id} currentStatus={c.status ?? "pending_payment"} statusColors={STATUS_COLORS} />
                    </td>
                    <td className="px-5 py-4 text-xs text-[#6e7a74] max-w-[160px] truncate">{c.notes ?? "—"}</td>
                    <td className="px-5 py-4 text-xs text-[#6e7a74]">{booked}</td>
                    <td className="px-5 py-4 text-xs text-[#3e4944]">
                      {c.id.slice(0, 8)}…
                    </td>
                  </tr>
                );
              })}
              {(consultations ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-[#6e7a74]">
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
