import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { getReservationDetail, listItems } from "@/lib/actions/reservation-detail-actions";
import { unitTypeLabel, paymentStatusLabel, reservationStatusLabel } from "@/lib/coworking/taxonomy";
import { BookingItems, UtilitiesToggle } from "./BookingItems";
import { BookingDocuments } from "./BookingDocuments";
import { resolveReservationId } from "@/lib/coworking/resolve";

export const dynamic = "force-dynamic";

/**
 * Whole rupiah.
 *
 * toLocaleString defaults to three fraction digits, so a rate that is not a
 * whole number rendered as "Rp4.166.666,667" — sen, which nothing here
 * transacts in, and three of them at that. Rounding at the point of display
 * keeps the stored figure exact and the shown one readable.
 */
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const waktu = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

export default async function BookingDetailPage({ params }: { params: Promise<{ resId: string }> }) {
  await requireAdmin();
  const { resId: param } = await params;
  const resId = await resolveReservationId(param);
  if (!resId) notFound();

  const r = await getReservationDetail(resId);
  if (!r) notFound();

  const catalog = await listItems(r.site_id);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/site" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12 max-w-[1100px]">
        <nav className="text-sm text-[#6e7a74] mb-4">
          <Link href="/site" className="hover:underline">Site</Link>
          <span className="mx-2">/</span>
          <Link href={`/site/${r.site_slug}`} className="hover:underline">{r.site_name}</Link>
          <span className="mx-2">/</span>
          <Link href={`/site/${r.site_slug}/calendar`} className="hover:underline">Kalender</Link>
          <span className="mx-2">/</span>
          <span className="text-[#3e4944]">{r.reservation_code}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">{r.who}</h1>
          <p className="text-[#3e4944] mt-1">
            {r.unit_name} · {unitTypeLabel(r.unit_type)} · {waktu(r.starts_at)} – {waktu(r.ends_at)}
          </p>
          <p className="text-sm text-[#6e7a74] mt-1">
            {r.reservation_code}
            {r.contract_ref && ` · ${r.contract_ref}`}
            {` · ${reservationStatusLabel(r.status)} · ${paymentStatusLabel(r.payment_status)}`}
            {r.event_title && ` · untuk event: ${r.event_title}`}
            {r.membership_holder && ` · kuota member: ${r.membership_holder}`}
          </p>
        </header>

        {/* ── the money ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Stat
            label="Nilai kontrak"
            value={rupiah(r.total_price)}
            hint={r.monthly_rate ? `${rupiah(r.monthly_rate)}/bulan disepakati` : "untuk seluruh masa kontrak"}
          />
          <Stat
            label="Tarif disepakati"
            value={`${rupiah(r.monthly_rate)}/bln`}
            hint={
              r.list_price === null ? "price list unit belum diisi"
              // Compared in whole rupiah, like they are shown. Comparing the
              // raw numerics made a two-thirds-of-a-rupiah rounding gap read
              // as a discount.
              : Math.round(r.monthly_rate) < Math.round(r.list_price) ? `di bawah price list ${rupiah(r.list_price)}`
              : Math.round(r.monthly_rate) > Math.round(r.list_price) ? `di atas price list ${rupiah(r.list_price)}`
              : "sama dengan price list"
            }
            tone={
              r.list_price !== null && Math.round(r.monthly_rate) < Math.round(r.list_price)
                ? "cost" : undefined
            }
          />
          <Stat label="Barang terjual" value={rupiah(r.item_sales)} />
          <Stat label="HPP konsumsi" value={rupiah(r.cogs)} tone={r.cogs > 0 ? "cost" : undefined} />
          <Stat
            label="Margin"
            value={rupiah(r.margin)}
            hint="Sewa + barang terjual − HPP"
            tone={r.margin < 0 ? "alert" : "good"}
          />
        </div>

        <div className="bg-white border border-[#ddd7d4] rounded-lg p-5 mb-8">
          <UtilitiesToggle reservationId={r.id} included={r.utilities_included} />
          {!r.utilities_included && (
            <p className="text-xs text-[#8a6416] bg-[#fdf4e3] border border-[#e6d09a] rounded px-3 py-2 mt-3">
              Penyewa membayar listrik &amp; internet sendiri. Biaya itu tidak
              masuk hitungan margin di atas, karena memang bukan biaya kita.
            </p>
          )}
        </div>

        <BookingItems
          reservationId={r.id}
          siteId={r.site_id}
          items={r.items}
          catalog={catalog}
        />

        <BookingDocuments reservationId={r.id} documents={r.documents} />

        <p className="text-xs text-[#6e7a74] mt-6 max-w-3xl">
          Margin di sini hanya menghitung yang bisa diukur per booking: sewa,
          barang yang keluar, dan harga pokoknya. Biaya tetap gedung — listrik,
          internet, cleaning — tidak dibagi ke tiap booking, karena pembagian
          itu perkiraan, bukan pengukuran, selama belum ada sub-meter.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label, value, hint, tone,
}: {
  label: string; value: string; hint?: string; tone?: "good" | "alert" | "cost";
}) {
  const colour =
    tone === "alert" ? "text-[#8c3a2c]"
    : tone === "good" ? "text-[#12614a]"
    : tone === "cost" ? "text-[#8a6416]"
    : "text-[#0d2137]";
  return (
    <div className="bg-white border border-[#ddd7d4] rounded-lg p-5">
      <div className="text-xs uppercase tracking-wide text-[#6e7a74]">{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${colour}`}>{value}</div>
      {hint && <div className="text-xs text-[#6e7a74] mt-1">{hint}</div>}
    </div>
  );
}
