import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReceipt } from "@/lib/reports/receipt";
import { PrintButton } from "@/components/print/PrintButton";
import { PRINT_CSS } from "@/components/print/print.css";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect(`/auth/login?next=/dashboard/receipts/${id}`);

  const receipt = await getReceipt(id);
  if (!receipt) notFound();

  // A receipt names a customer and states what they paid — it belongs to them
  // and to an admin, nobody else.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users").select("is_admin").eq("id", user.id).single();

  if (receipt.userId !== user.id && !profile?.is_admin) {
    notFound();
  }

  const charged = receipt.lines.filter((l) => !l.refundable);
  const refundable = receipt.lines.filter((l) => l.refundable);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <main className="min-h-screen bg-[#f6f3f2] px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-5 no-print">
            <Link href="/dashboard/statement" className="text-sm text-[#1a7a5e] font-semibold hover:underline inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Rekening koran
            </Link>
            <PrintButton />
          </div>

          <article className="print-sheet bg-white rounded-xl border border-[#cccccc] p-8 md:p-10">
            {/* Header */}
            <div className="flex justify-between items-start gap-6 pb-6 border-b-2 border-[#0d2137]">
              <div>
                <p className="text-2xl font-extrabold text-[#0d2137] tracking-tight">VeriHome</p>
                <p className="text-xs text-[#6e7a74] mt-1 leading-relaxed">
                  Sewa properti tepercaya di Jakarta<br />
                  support@verihome.id
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6e7a74]">Kuitansi</p>
                <p className="text-xs text-[#6e7a74]">Receipt</p>
                <p className="font-bold text-[#0d2137] mt-1 tabular-nums">{receipt.number}</p>
                <p className="text-xs text-[#6e7a74] mt-1">Diterbitkan {receipt.issuedAt}</p>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-[#e4e2e1]">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#6e7a74] mb-1">
                  Pelanggan <span className="font-normal normal-case">/ Customer</span>
                </p>
                <p className="font-semibold text-[#0d2137]">{receipt.customerName}</p>
                <p className="text-sm text-[#3e4944]">{receipt.customerEmail}</p>
              </div>
              {receipt.property && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6e7a74] mb-1">
                    Properti <span className="font-normal normal-case">/ Property</span>
                  </p>
                  <p className="font-semibold text-[#0d2137]">{receipt.property.name}</p>
                  {receipt.property.area && <p className="text-sm text-[#3e4944]">{receipt.property.area}</p>}
                </div>
              )}
            </div>

            {receipt.kind === "booking" && (
              <div className="grid grid-cols-3 gap-4 py-5 border-b border-[#e4e2e1] text-sm">
                <Field label="Check-in" value={receipt.checkIn ?? "—"} />
                <Field label="Check-out" value={receipt.checkOut ?? "—"} />
                <Field label="Malam / Nights" value={String(receipt.nights ?? "—")} />
              </div>
            )}

            {/* Lines */}
            <table className="w-full mt-6 text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                  <th className="text-left py-2 font-medium">Keterangan / Description</th>
                  <th className="text-right py-2 font-medium">Jumlah / Amount</th>
                </tr>
              </thead>
              <tbody>
                {charged.map((l) => (
                  <tr key={l.label} className="border-b border-[#f6f3f2]">
                    <td className="py-2.5">
                      <span className="text-[#0d2137]">{l.label}</span>
                      <span className="block text-xs text-[#6e7a74]">{l.labelEn}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-[#0d2137]">
                      {l.amount < 0 ? `− ${fmt(Math.abs(l.amount))}` : fmt(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {refundable.length > 0 && (
              <div className="mt-5 bg-[#f6f3f2] rounded-lg p-4 avoid-break">
                <p className="text-xs font-bold uppercase tracking-wider text-[#3e4944] mb-2">
                  Dapat dikembalikan <span className="font-normal normal-case">/ Refundable</span>
                </p>
                {refundable.map((l) => (
                  <div key={l.label} className="flex justify-between text-sm py-1">
                    <span className="text-[#3e4944]">
                      {l.label}
                      <span className="block text-xs text-[#6e7a74]">{l.labelEn}</span>
                    </span>
                    <span className="tabular-nums text-[#0d2137]">{fmt(l.amount)}</span>
                  </div>
                ))}
                <p className="text-xs text-[#6e7a74] mt-2 pt-2 border-t border-[#e4e2e1]">
                  Bukan biaya — dikembalikan sesuai syarat dan ketentuan.
                  <span className="block">Not a charge — returned per the terms of your booking.</span>
                </p>
              </div>
            )}

            <div className="flex justify-between items-baseline gap-4 mt-6 pt-4 border-t-2 border-[#0d2137]">
              <div>
                <p className="font-bold text-[#0d2137]">TOTAL DIBAYAR</p>
                <p className="text-xs text-[#6e7a74]">Total paid</p>
              </div>
              <p className="text-2xl font-bold text-[#0d2137] tabular-nums">IDR {fmt(receipt.totalPaid)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <Field label="Metode pembayaran / Method" value={receipt.paymentMethod} />
              <Field
                label="Diterima pada / Received"
                value={receipt.paidAt ? String(receipt.paidAt).slice(0, 10) : "Belum diterima"}
              />
            </div>

            {!receipt.paidAt && (
              <p className="mt-5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                Pembayaran belum dikonfirmasi. Kuitansi ini menjadi sah setelah transfer diverifikasi.
                <span className="block text-xs mt-1">
                  Payment not yet confirmed. This receipt is valid once the transfer is verified.
                </span>
              </p>
            )}

            <p className="text-xs text-[#6e7a74] mt-8 pt-4 border-t border-[#e4e2e1]">
              Dokumen ini dibuat otomatis dan sah tanpa tanda tangan.
              <span className="block">This document is computer-generated and valid without signature.</span>
            </p>
          </article>
        </div>
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#6e7a74]">{label}</p>
      <p className="text-[#0d2137] font-medium mt-0.5">{value}</p>
    </div>
  );
}
