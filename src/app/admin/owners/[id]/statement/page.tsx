import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "@/components/print/PrintButton";
import { PRINT_CSS } from "@/components/print/print.css";

export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const n = (v: unknown) => Math.round(Number(v ?? 0));

export default async function OwnerStatementPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ months?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const months = [3, 6, 12].includes(Number(sp.months)) ? Number(sp.months) : 6;

  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - months + 1, 1));

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners").select("id, name, email, phone_whatsapp").eq("id", id).maybeSingle();
  if (!owner) notFound();

  const { data: properties } = await admin
    .from("properties").select("id, name, area").eq("owner_id", id);
  const propertyIds = (properties ?? []).map((p) => p.id);

  // All figures come from the ledger, so what the owner is shown is the same
  // number the books carry — no second calculation to drift from it.
  const { data: entries } = propertyIds.length
    ? await admin
        .from("ledger_entries")
        .select("entry_date, event_type, account, direction, amount, booking_id, property_id")
        .in("property_id", propertyIds)
        .gte("entry_date", from.toISOString())
        .lt("entry_date", to.toISOString())
    : { data: [] };

  const { data: payouts } = await admin
    .from("ledger_entries")
    .select("entry_date, amount, description")
    .eq("owner_id", id)
    .eq("event_type", "owner_payout_paid")
    .eq("account", "owner_payable")
    .eq("direction", "debit")
    .order("entry_date", { ascending: false });

  const rows = entries ?? [];
  const bookingIds = [...new Set(rows.filter((e) => e.booking_id).map((e) => e.booking_id as string))];

  const { data: bookings } = bookingIds.length
    ? await admin
        .from("bookings")
        .select("id, booking_code, check_in_date, check_out_date, nights, total_price, property_id, status, user:users(name)")
        .in("id", bookingIds)
    : { data: [] };

  const propsById = new Map((properties ?? []).map((p) => [p.id, p]));

  // Per booking: gross guest payment, VeriHome's cut, what is owed onward.
  const detail = (bookings ?? []).map((b) => {
    const forBooking = rows.filter((e) => e.booking_id === b.id);
    const sumOf = (acct: string, dir: "debit" | "credit") =>
      forBooking.filter((e) => e.account === acct && e.direction === dir)
                .reduce((s, e) => s + n(e.amount), 0);

    const gross = sumOf("cash", "debit");
    const ownerShare = sumOf("owner_payable", "credit") - sumOf("owner_payable", "debit");
    const commission =
      sumOf("revenue_booking_margin", "credit") + sumOf("revenue_cleaning", "credit");

    return {
      code: b.booking_code,
      guest: ((b.user as { name?: string } | null)?.name ?? "—").split(" ")[0],
      property: propsById.get(b.property_id as string)?.name ?? "—",
      checkIn: b.check_in_date, checkOut: b.check_out_date,
      nights: n(b.nights) || Math.max(0, Math.round(
        (+new Date(String(b.check_out_date)) - +new Date(String(b.check_in_date))) / 86_400_000)),
      gross, commission, ownerShare,
      settled: b.status === "completed",
    };
  });

  const grossTotal = detail.reduce((s, d) => s + d.gross, 0);
  const commissionTotal = detail.reduce((s, d) => s + d.commission, 0);

  // Deposit money paid across to the owner for damage is owed on top.
  const depositClaims = rows
    .filter((e) => e.event_type === "security_deposit_claimed" && e.account === "owner_payable" && e.direction === "credit")
    .reduce((s, e) => s + n(e.amount), 0);

  const earned = detail.reduce((s, d) => s + d.ownerShare, 0) + depositClaims;
  const paidOut = (payouts ?? []).reduce((s, p) => s + n(p.amount), 0);
  const outstanding = earned - paidOut;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <main className="min-h-screen bg-[#f6f3f2] px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
            <Link href="/admin/listings" className="text-sm text-[#1a7a5e] font-semibold hover:underline inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Admin
            </Link>
            <div className="flex gap-2">
              {[3, 6, 12].map((m) => (
                <Link key={m} href={`/admin/owners/${id}/statement?months=${m}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    months === m ? "bg-white border-[#1a7a5e] text-[#1a7a5e]"
                                 : "bg-white border-[#cccccc] text-[#3e4944] hover:border-[#1a7a5e]"}`}>
                  {m} bln
                </Link>
              ))}
              <PrintButton label="Unduh PDF untuk dikirim" />
            </div>
          </div>

          <article className="print-sheet bg-white rounded-xl border border-[#cccccc] p-8 md:p-10">
            <div className="flex justify-between items-start gap-6 pb-6 border-b-2 border-[#0d2137]">
              <div>
                <p className="text-2xl font-extrabold text-[#0d2137] tracking-tight">VeriHome</p>
                <p className="text-xs text-[#6e7a74] mt-1">Laporan pemilik properti / Owner statement</p>
              </div>
              <div className="text-right text-xs text-[#6e7a74]">
                <p className="font-semibold text-[#0d2137]">{owner.name}</p>
                {owner.email && <p>{owner.email}</p>}
                {owner.phone_whatsapp && <p>{owner.phone_whatsapp}</p>}
                <p className="mt-1">{from.toISOString().slice(0, 10)} – {to.toISOString().slice(0, 10)}</p>
              </div>
            </div>

            {/* Period summary */}
            <section className="py-6 border-b border-[#e4e2e1]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#3e4944] mb-3">
                Ringkasan periode
              </h2>
              <Row label="Pemesanan pada properti Anda" value={String(detail.length)} plain />
              <Row label="Pembayaran tamu (bruto)" value={fmt(grossTotal)} />
              <Row label="Dikurangi komisi VeriHome" value={`− ${fmt(commissionTotal)}`} />
              {depositClaims > 0 && (
                <Row label="Ditambah klaim jaminan kerusakan" value={`+ ${fmt(depositClaims)}`} />
              )}
              <div className="flex justify-between gap-4 pt-3 mt-2 border-t border-[#cccccc] font-bold">
                <span className="text-[#0d2137]">HAK BERSIH PEMILIK</span>
                <span className="tabular-nums text-[#0d2137]">IDR {fmt(earned)}</span>
              </div>
            </section>

            {/* Booking detail */}
            <section className="py-6 border-b border-[#e4e2e1]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#3e4944] mb-3">
                Rincian pemesanan
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 560 }}>
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                      <th className="text-left py-2 font-medium">Tamu</th>
                      <th className="text-left py-2 font-medium">Tanggal</th>
                      <th className="text-right py-2 font-medium">Malam</th>
                      <th className="text-right py-2 font-medium">Bruto</th>
                      <th className="text-right py-2 font-medium">Komisi</th>
                      <th className="text-right py-2 font-medium">Hak Anda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((d) => (
                      <tr key={d.code} className="border-b border-[#f6f3f2]">
                        <td className="py-2.5">
                          <span className="text-[#0d2137]">{d.guest}</span>
                          <span className="block text-xs text-[#6e7a74]">{d.property}</span>
                        </td>
                        <td className="py-2.5 text-xs text-[#6e7a74] whitespace-nowrap">
                          {d.checkIn} → {d.checkOut}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{d.nights}</td>
                        <td className="py-2.5 text-right tabular-nums text-[#6e7a74]">{fmt(d.gross)}</td>
                        <td className="py-2.5 text-right tabular-nums text-[#6e7a74]">− {fmt(d.commission)}</td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-[#0d2137]">
                          {fmt(d.ownerShare)}
                          {!d.settled && (
                            <span className="block text-[10px] font-normal text-amber-700">belum selesai</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {detail.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-[#6e7a74]">
                        Belum ada pemesanan pada periode ini.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Payout history */}
            <section className="py-6 border-b border-[#e4e2e1]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#3e4944] mb-3">
                Riwayat pembayaran
              </h2>
              {(payouts ?? []).length === 0 ? (
                <p className="text-sm text-[#6e7a74]">Belum ada pembayaran.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {(payouts ?? []).map((p, i) => (
                      <tr key={i} className="border-b border-[#f6f3f2]">
                        <td className="py-2 text-[#6e7a74] whitespace-nowrap">{String(p.entry_date).slice(0, 10)}</td>
                        <td className="py-2 text-[#3e4944]">{p.description ?? "Pembayaran"}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-[#0d2137]">
                          {fmt(n(p.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <div className={`flex justify-between items-baseline gap-4 py-5 ${
              outstanding > 0 ? "" : "opacity-80"}`}>
              <div>
                <p className="font-bold text-[#0d2137]">SISA YANG TERHUTANG</p>
                <p className="text-xs text-[#6e7a74]">Outstanding balance due</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-[#0d2137]">IDR {fmt(outstanding)}</p>
            </div>

            <p className="text-xs text-[#6e7a74] mt-4 pt-4 border-t border-[#e4e2e1]">
              Dokumen ini adalah <strong>laporan</strong>, bukan faktur pajak.
              <span className="block">This is a statement, not a tax invoice.</span>
            </p>
          </article>
        </div>
      </main>
    </>
  );
}

function Row({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-[#3e4944]">{label}</span>
      <span className={`tabular-nums text-[#0d2137] ${plain ? "" : "font-medium"}`}>
        {plain ? value : `IDR ${value}`}
      </span>
    </div>
  );
}
