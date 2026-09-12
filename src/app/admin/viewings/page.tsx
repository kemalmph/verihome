import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default async function AdminViewingsPage() {
  const admin = createAdminClient();

  const { data: viewings } = await admin
    .from("viewings")
    .select(`
      id, preferred_date, preferred_time, notes, status,
      deposit_amount, deposit_paid, attended, credit_issued,
      bank_transfer_code, payment_proof_url, created_at,
      property:properties ( id, name, area ),
      user:users ( id, name, email, phone_whatsapp )
    `)
    .order("preferred_date", { ascending: true });

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/viewings" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0d2137]">Viewings</h1>
          <p className="text-[#6e7a74] text-sm mt-1">All property viewing requests</p>
        </div>

        {!viewings || viewings.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#cccccc] p-12 text-center">
            <span className="material-symbols-outlined text-[#cccccc] text-5xl">location_on</span>
            <p className="text-[#6e7a74] mt-4">No viewing requests yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#cccccc] text-[#6e7a74] text-xs uppercase">
                  <th className="text-left py-3 px-4">Property</th>
                  <th className="text-left py-3 px-4">Guest</th>
                  <th className="text-left py-3 px-4">Date / Time</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Deposit</th>
                  <th className="text-left py-3 px-4">Attended</th>
                </tr>
              </thead>
              <tbody>
                {viewings.map((v) => {
                  const property = (v.property as unknown) as { name: string; area: string } | null;
                  const user     = (v.user     as unknown) as { name: string; email: string; phone_whatsapp: string | null } | null;
                  return (
                    <tr key={v.id} className="border-b border-[#f6f3f2] hover:bg-[#f6f3f2] bg-white">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0d2137]">{property?.name ?? "—"}</div>
                        <div className="text-xs text-[#6e7a74]">{property?.area}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{user?.name ?? "—"}</div>
                        <div className="text-xs text-[#6e7a74]">{user?.email}</div>
                        {user?.phone_whatsapp && <div className="text-xs text-[#6e7a74]">{user.phone_whatsapp}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div>{v.preferred_date}</div>
                        <div className="text-xs text-[#6e7a74]">{v.preferred_time}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          v.status === "confirmed" ? "bg-green-100 text-green-700" :
                          v.status === "cancelled" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {v.deposit_amount ? (
                          <div>
                            <span className={`text-xs font-semibold ${v.deposit_paid ? "text-green-700" : "text-amber-700"}`}>
                              {v.deposit_paid ? "Paid" : "Unpaid"}
                            </span>
                            <div className="text-xs text-[#6e7a74]">IDR {fmt(Number(v.deposit_amount))}</div>
                            {v.bank_transfer_code && (
                              <div className="text-xs text-[#6e7a74]">Code: {v.bank_transfer_code}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#6e7a74]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {v.attended === null ? (
                          <span className="text-xs text-[#6e7a74]">Pending</span>
                        ) : v.attended ? (
                          <span className="text-xs text-green-700 font-semibold">Yes {v.credit_issued ? "✓ Credit" : ""}</span>
                        ) : (
                          <span className="text-xs text-red-700 font-semibold">No-show</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
