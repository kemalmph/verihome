"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Events, and the space they hold.
 *
 * The rule the schema sets and this enforces: an event does not block a room.
 * It books one through unit_reservations, so the exclusion constraint remains
 * the single thing deciding whether a room is free. Everything here goes
 * through that path — there is no way to make an event occupy a space without
 * creating a reservation, by design.
 */

/**
 * A local datetime from a form, as an instant.
 *
 * <input type="datetime-local"> gives "2026-12-10T18:00" with no zone, and
 * whatever zone the server guesses will be wrong: the operator typed Jakarta
 * time, and this container runs in UTC. Seven hours of silent drift, which on
 * an event calendar means an evening workshop filed as a lunchtime one.
 */
function jakartaInstant(local: string | null): string | null {
  if (!local) return null;
  const m = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return null;
  return `${m[1]}T${m[2]}:00+07:00`;
}

const txt = (fd: FormData, k: string) => {
  const v = ((fd.get(k) as string) ?? "").trim();
  return v === "" ? null : v;
};

export async function createEvent(siteId: string, fd: FormData) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const admin = createAdminClient();

  const title = txt(fd, "title");
  if (!title) return { error: "Judul event harus diisi." };

  const starts_at = jakartaInstant(txt(fd, "starts_at"));
  const ends_at = jakartaInstant(txt(fd, "ends_at"));
  if (!starts_at || !ends_at) return { error: "Waktu mulai dan selesai harus diisi." };
  if (new Date(ends_at) <= new Date(starts_at)) {
    return { error: "Waktu selesai harus setelah waktu mulai." };
  }

  const attendees = ((fd.get("expected_attendees") as string) ?? "").trim();

  const { data: ev, error } = await admin
    .from("events")
    .insert({
      site_id: siteId,
      title,
      description: txt(fd, "description"),
      starts_at,
      ends_at,
      host_name: txt(fd, "host_name"),
      expected_attendees: attendees === "" ? null : Math.max(0, parseInt(attendees, 10) || 0),
      status: (fd.get("status") as string) || "draft",
      visibility: (fd.get("visibility") as string) || "internal",
      notes: txt(fd, "notes"),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Booking the room is optional at creation but the usual case, so the form
  // offers it. It goes through the same path as any other booking.
  const unitId = txt(fd, "unit_id");
  if (unitId) {
    const setup = parseInt(((fd.get("setup_minutes") as string) ?? "0"), 10) || 0;
    const held = await bookRoomForEvent(siteId, ev.id, unitId, starts_at, ends_at, setup);
    if (held.error) {
      // The event exists; the room does not. Say so plainly rather than
      // leaving the operator to discover it on the calendar — but do not
      // delete the event, because the room may simply need to be a different
      // one and retyping the whole form is a punishment for a near miss.
      return { success: true, id: ev.id, warning: `Event dibuat, tapi ruangan gagal dipesan: ${held.error}` };
    }
  }

  revalidatePath(`/admin/coworking/${siteId}/calendar`);
  return { success: true, id: ev.id };
}

/**
 * Hold a room for an event, with setup time either side.
 *
 * Inserted directly rather than through create_unit_reservation_if_available
 * because that function requires a user id and an event's hold belongs to the
 * event, not a person. The exclusion constraint still applies — a room
 * already taken will refuse this insert, which is the guarantee that matters.
 */
export async function bookRoomForEvent(
  siteId: string,
  eventId: string,
  unitId: string,
  startsAt: string,
  endsAt: string,
  setupMinutes = 0,
) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const admin = createAdminClient();

  const { data: unit } = await admin
    .from("lettable_units")
    .select("id, name, letting_mode, price, exclusive_use, status")
    .eq("id", unitId).eq("site_id", siteId).maybeSingle();
  if (!unit) return { error: "Unit tidak ada di site ini." };
  if (unit.status !== "available") return { error: `${unit.name} sedang tidak bisa disewakan.` };

  const from = new Date(new Date(startsAt).getTime() - setupMinutes * 60000).toISOString();
  const to = new Date(new Date(endsAt).getTime() + setupMinutes * 60000).toISOString();

  const code = `CW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36).slice(2, 6).toUpperCase()}`;

  const { data: ev } = await admin.from("events").select("title").eq("id", eventId).maybeSingle();

  const { error } = await admin.from("unit_reservations").insert({
    reservation_code: code,
    unit_id: unitId,
    user_id: null,
    tenant_name: ev?.title ?? "Event",
    event_id: eventId,
    starts_at: from,
    ends_at: to,
    seats: 1,
    letting_mode: unit.letting_mode,
    unit_price: unit.price ?? 0,
    total_price: 0,
    exclusive_use: unit.exclusive_use,
    status: "confirmed",
    payment_status: "unpaid",
  });

  if (error) {
    // The exclusion constraint speaks in Postgres; an operator should not have
    // to.
    if (/no_overlap/.test(error.message)) {
      return { error: `${unit.name} sudah dipesan pada jam itu.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/coworking/${siteId}/calendar`);
  return { success: true };
}

export async function setEventStatus(siteId: string, eventId: string, status: string) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  if (!["draft", "confirmed", "cancelled", "done"].includes(status)) {
    return { error: "Status tidak dikenal." };
  }
  const admin = createAdminClient();

  // An event cannot be confirmed while part of it has no room. This is where
  // event_space_gaps() is enforced — it is a function, not a constraint,
  // because the answer spans several reservation rows, so the rule has to
  // live in the one place that publishes an event.
  if (status === "confirmed") {
    const { data: gaps } = await admin.rpc("event_space_gaps", { p_event_id: eventId });
    if ((gaps ?? []).length > 0) {
      const g = gaps[0] as { gap_start: string; gap_end: string };
      const fmt = (iso: string) =>
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        }).format(new Date(iso));
      return {
        error:
          `Belum bisa dikonfirmasi: belum ada booking ruangan untuk ${fmt(g.gap_start)}–${fmt(g.gap_end)}` +
          `${gaps.length > 1 ? ` dan ${gaps.length - 1} rentang lain` : ""}.`,
      };
    }
  }

  const { error } = await admin.from("events").update({ status }).eq("id", eventId).eq("site_id", siteId);
  if (error) return { error: error.message };

  // Cancelling an event releases the rooms it held: a cancelled reservation
  // no longer blocks, and leaving them confirmed would keep a hall off the
  // market for an event nobody is running.
  if (status === "cancelled") {
    const { error: relErr } = await admin
      .from("unit_reservations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .in("status", ["pending", "confirmed"]);
    if (relErr) return { error: relErr.message };
  }

  revalidatePath(`/admin/coworking/${siteId}/calendar`);
  return { success: true };
}
