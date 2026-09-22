import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";
import { requireOwner, NotFoundError, ownedProperty } from "@/lib/auth/guards";
import { ownerCalendar } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";
import { CalendarBoard } from "./CalendarBoard";

export const dynamic = "force-dynamic";

export default async function OwnerCalendarPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;

  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }

  // Month window, defaulting to the current month.
  const base = m && /^\d{4}-\d{2}$/.test(m) ? new Date(`${m}-01T00:00:00`) : new Date();
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  let property, cal;
  try {
    property = await ownedProperty(owner.ownerId, id);
    cal = await ownerCalendar(id, iso(first), iso(last));
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const prev = new Date(first.getFullYear(), first.getMonth() - 1, 1);
  const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <OwnerSidebar activeHref="/owner/properties" ownerName={owner.ownerName} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 max-w-3xl">
        <Link href={`/owner/properties/${id}`} className="text-sm text-[#1a7a5e] hover:underline">
          ← {property.name}
        </Link>

        <header className="mt-3 mb-6 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#0d2137]">{t("owner.calendar.title")}</h1>
            <p className="text-sm text-[#3e4944] mt-1">
              {first.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`?m=${ym(prev)}`} className="px-3 py-1.5 border border-[#cccccc] rounded-lg text-sm hover:bg-white">←</Link>
            <Link href={`?m=${ym(next)}`} className="px-3 py-1.5 border border-[#cccccc] rounded-lg text-sm hover:bg-white">→</Link>
          </div>
        </header>

        <CalendarBoard
          propertyId={id}
          year={first.getFullYear()}
          month={first.getMonth()}
          blocks={cal.blocks.map((b) => ({
            id: b.id as string,
            start: b.start_date as string,
            end: b.end_date as string,
            reason: b.reason as string,
            isBookingHold: Boolean(b.booking_id),
            mine: b.created_by_owner === owner.ownerId,
          }))}
          bookings={cal.bookings.map((b) => ({
            start: b.check_in_date as string,
            end: b.check_out_date as string,
          }))}
          bufferDays={cal.bufferDays}
        />
      </main>
    </div>
  );
}
