import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLedgerBalances, balanceOf } from "@/lib/ledger/post";
import { SpendForm } from "./SpendForm";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

export default async function ExpensesPage() {
  const admin = createAdminClient();

  const [{ data: entries }, balances] = await Promise.all([
    admin
      .from("ledger_entries")
      .select("id, entry_date, event_type, amount, description")
      .in("account", ["expense_operating", "equity_drawings"])
      .eq("direction", "debit")
      .order("entry_date", { ascending: false })
      .limit(100),
    getLedgerBalances({ client: admin }),
  ]);

  const operating = balanceOf(balances, "expense_operating");
  const drawings  = balanceOf(balances, "equity_drawings");
  const cash      = balanceOf(balances, "cash");
  const liabilities =
    balanceOf(balances, "deposits_held") + balanceOf(balances, "credits_outstanding") +
    balanceOf(balances, "unearned_revenue") + balanceOf(balances, "owner_payable");
  const available = cash - liabilities;

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/expenses" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12 max-w-[900px]">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">Pengeluaran VeriHome</h1>
          <p className="text-[#3e4944] mt-1">
            Uang yang keluar untuk keperluan VeriHome sendiri — bukan pengembalian
            jaminan dan bukan hak pemilik properti.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Stat label="Biaya operasional" value={operating} />
          <Stat label="Penarikan pemilik" value={drawings} />
          <Stat
            label="Dana yang boleh dibelanjakan"
            value={available}
            tone={available < 0 ? "bad" : "good"}
            hint={available < 0 ? "Sudah memakai dana pihak lain" : undefined}
          />
        </div>

        <SpendForm available={available} />

        <div className="bg-white rounded-xl border border-[#cccccc] overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-[#e4e2e1]">
            <h2 className="font-bold text-[#0d2137]">Riwayat</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                  <th className="text-left px-6 py-2 font-medium">Tanggal</th>
                  <th className="text-left px-6 py-2 font-medium">Jenis</th>
                  <th className="text-left px-6 py-2 font-medium">Keterangan</th>
                  <th className="text-right px-6 py-2 font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f6f3f2]">
                {(entries ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="px-6 py-2.5 text-[#6e7a74] whitespace-nowrap">
                      {String(e.entry_date).slice(0, 10)}
                    </td>
                    <td className="px-6 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        e.event_type === "equity_drawing_paid"
                          ? "bg-purple-100 text-purple-800" : "bg-[#f6f3f2] text-[#3e4944]"
                      }`}>
                        {e.event_type === "equity_drawing_paid" ? "Penarikan" : "Operasional"}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-[#3e4944]">{e.description ?? "—"}</td>
                    <td className="px-6 py-2.5 text-right tabular-nums font-semibold text-[#0d2137]">
                      {fmt(Number(e.amount))}
                    </td>
                  </tr>
                ))}
                {(entries ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-[#6e7a74]">
                    Belum ada pengeluaran tercatat.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone, hint }: {
  label: string; value: number; tone?: "good" | "bad"; hint?: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${
      tone === "bad" ? "bg-red-50 border-[#cf2f52]" : "bg-white border-[#cccccc]"
    }`}>
      <p className="text-xs font-semibold text-[#6e7a74] uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${
        tone === "bad" ? "text-[#cf2f52]" : tone === "good" ? "text-[#0d8f66]" : "text-[#0d2137]"
      }`}>
        IDR {fmt(value)}
      </p>
      {hint && <p className="text-xs text-[#cf2f52] mt-1 font-medium">{hint}</p>}
    </div>
  );
}
