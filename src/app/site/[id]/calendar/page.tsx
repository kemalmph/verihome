import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { getSiteCalendar, type CalBooking } from "@/lib/actions/coworking-calendar";
import { unitTypeLabel } from "@/lib/coworking/taxonomy";
import { NewEventForm, EventControls } from "./EventForm";
import { resolveSiteId } from "@/lib/coworking/resolve";

export const dynamic = "force-dynamic";

const jam = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso));
const tanggalJam = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

export default async function SiteCalendarPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  await requirePermissionOrRedirect(["sites.operate_all"]);
  const { id: param } = await params;
  const id = await resolveSiteId(param);
  if (!id) notFound();

  const { week } = await searchParams;

  const cal = await getSiteCalendar(id, week);
  if (!cal) notFound();

  const { site, days, units, bookings, events } = cal;

  // One lookup instead of scanning every booking for every cell.
  const byUnitDay = new Map<string, CalBooking[]>();
  for (const b of bookings) {
    for (const d of b.days) {
      const k = `${b.unit_id}|${d}`;
      const list = byUnitDay.get(k);
      if (list) list.push(b);
      else byUnitDay.set(k, [b]);
    }
  }

  const eventsWithGaps = events.filter((e) => e.gaps.length > 0);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AppSidebar activeHref={`/site/${param}`} />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <nav className="text-sm text-[#6e7a74] mb-4">
          <Link href="/site" className="hover:underline">Site</Link>
          <span className="mx-2">/</span>
          <Link href={`/site/${site.slug}`} className="hover:underline">{site.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-[#3e4944]">Kalender</span>
        </nav>

        <header className="mb-6 flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2137]">Kalender</h1>
            <p className="text-[#3e4944] mt-1">
              {days[0].label} – {days[6].label} · waktu Jakarta
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NavLink href={`/site/${site.slug}/calendar?week=${cal.prev_week}`}>← Minggu lalu</NavLink>
            <NavLink href={`/site/${site.slug}/calendar`}>Minggu ini</NavLink>
            <NavLink href={`/site/${site.slug}/calendar?week=${cal.next_week}`}>Minggu depan →</NavLink>
          </div>
        </header>

        <div className="mb-6">
          <NewEventForm
            siteId={site.id}
            units={units.filter((u) => u.status === "available")}
            defaultDay={days[0].ymd}
          />
        </div>

        {/* An event announced in a room nobody booked is the failure this
            whole design exists to prevent, so it goes at the top. */}
        {eventsWithGaps.length > 0 && (
          <section className="mb-6 bg-white border border-[#e2b3ab] rounded-lg overflow-hidden">
            <h2 className="px-5 py-3 bg-[#fbeeec] text-sm font-semibold text-[#8c3a2c]">
              Event tanpa ruangan
            </h2>
            <ul className="divide-y divide-[#f0ecea]">
              {eventsWithGaps.map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm">
                  <span className="font-medium text-[#0d2137]">{e.title}</span>
                  <span className="text-[#6e7a74]"> — belum ada booking ruangan untuk </span>
                  {e.gaps.map((g, i) => (
                    <span key={i} className="text-[#8c3a2c]">
                      {i > 0 && ", "}{tanggalJam(g.gap_start)}–{jam(g.gap_end)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── the week chart ──────────────────────────────────────────── */}
        <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-x-auto mb-8">
          {units.length === 0 ? (
            <p className="p-8 text-center text-[#6e7a74] text-sm">Belum ada unit di site ini.</p>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-[#efeae8]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6e7a74] w-44">
                    Unit
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.ymd}
                      className={`px-2 py-3 text-xs font-semibold tracking-wide ${
                        d.is_today ? "text-[#1a7a5e] bg-[#e8f5f0]" : "text-[#6e7a74]"
                      }`}
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-t border-[#e8e3e0]">
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium text-[#0d2137]">{u.name}</div>
                      <div className="text-xs text-[#6e7a74]">{unitTypeLabel(u.unit_type)}</div>
                      {u.status !== "available" && (
                        <div className="text-xs text-[#8c3a2c] mt-0.5">
                          {u.status === "maintenance" ? "Perbaikan" : "Tidak aktif"}
                        </div>
                      )}
                    </td>
                    {days.map((d) => {
                      const cell = byUnitDay.get(`${u.id}|${d.ymd}`) ?? [];
                      return (
                        <td
                          key={d.ymd}
                          className={`px-1.5 py-2 align-top ${d.is_today ? "bg-[#f3faf7]" : ""}`}
                        >
                          {cell.length === 0 ? (
                            <div className="h-7 rounded border border-dashed border-[#e4ded9]" />
                          ) : (
                            cell.map((b) => <Chip key={b.id} b={b} />)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── agenda ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-hidden">
            <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-[#0d2137]">
              Booking minggu ini ({bookings.length})
            </h2>
            {bookings.length === 0 ? (
              <p className="p-8 text-center text-[#6e7a74] text-sm">Tidak ada booking.</p>
            ) : (
              <ul className="divide-y divide-[#f0ecea]">
                {bookings.map((b) => (
                  <li key={b.id} className="px-5 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/site/booking/${b.code}`}
                          className="font-medium text-[#1a7a5e] hover:underline truncate block"
                          title={b.who}
                        >
                          {b.who}
                        </Link>
                        <div className="text-xs text-[#6e7a74]">
                          {units.find((u) => u.id === b.unit_id)?.name}
                          {" · "}
                          {b.time_label ?? `${tanggalJam(b.starts_at)} – ${tanggalJam(b.ends_at)}`}
                          {b.contract_ref && ` · ${b.contract_ref}`}
                        </div>
                        {b.event_title && (
                          <div className="text-xs text-[#2d4a86] mt-0.5">untuk event: {b.event_title}</div>
                        )}
                      </div>
                      {b.payment_status !== "paid" && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-[#fdf4e3] text-[#8a6416] border-[#e6d09a] whitespace-nowrap">
                          belum lunas
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-hidden">
            <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-[#0d2137]">
              Event minggu ini ({events.length})
            </h2>
            {events.length === 0 ? (
              <p className="p-8 text-center text-[#6e7a74] text-sm">Tidak ada event.</p>
            ) : (
              <ul className="divide-y divide-[#f0ecea]">
                {events.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <div className="font-medium text-[#0d2137]">{e.title}</div>
                    <div className="text-xs text-[#6e7a74]">
                      {tanggalJam(e.starts_at)} – {jam(e.ends_at)}
                      {e.host && ` · ${e.host}`}
                    </div>
                    <div className="text-xs mt-0.5">
                      {e.unit_names.length > 0 ? (
                        <span className="text-[#12614a]">Ruangan: {e.unit_names.join(", ")}</span>
                      ) : (
                        <span className="text-[#8c3a2c]">Belum memesan ruangan</span>
                      )}
                      {e.status !== "confirmed" && (
                        <span className="text-[#6e7a74]"> · {e.status === "draft" ? "draf" : e.status}</span>
                      )}
                    </div>
                    <EventControls
                      siteId={site.id}
                      eventId={e.id}
                      status={e.status}
                      hasGaps={e.gaps.length > 0}
                      units={units.filter((u) => u.status === "available").map((u) => ({ id: u.id, name: u.name }))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] bg-white hover:bg-[#f6f3f2]"
    >
      {children}
    </Link>
  );
}

function Chip({ b }: { b: CalBooking }) {
  // Blue for an event's hold, green for an ordinary let, amber while it is
  // only pending — pending still holds the room, so it cannot look free.
  const tone = b.event_id
    ? "bg-[#eef2fb] text-[#2d4a86] border-[#b6c6e8]"
    : b.status === "pending"
      ? "bg-[#fdf4e3] text-[#8a6416] border-[#e6d09a]"
      : "bg-[#e8f5f0] text-[#12614a] border-[#a9dcc8]";
  return (
    <div
      className={`text-[11px] leading-tight px-1.5 py-1 mb-1 rounded border truncate ${tone}`}
      title={`${b.who}${b.time_label ? ` · ${b.time_label}` : ""}`}
    >
      {b.time_label && <span className="font-medium">{b.time_label} </span>}
      {b.event_title ?? b.who}
    </div>
  );
}
