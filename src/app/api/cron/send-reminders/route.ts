import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cron: send check-in and payment expiry reminders.
// Runs daily. Marks rows so each reminder fires at most once.
// Actual delivery (email/WhatsApp) plugs in here via the returned arrays.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin  = createAdminClient();
  const today  = new Date();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // ── Check-in reminders (confirmed bookings checking in tomorrow) ──
  const { data: checkIns } = await admin
    .from("bookings")
    .select("id, booking_code, user_id, check_in_date, check_out_date, property:properties(name, area)")
    .eq("status", "confirmed")
    .eq("check_in_date", tomorrowStr)
    .is("checkin_reminder_sent_at", null);

  if (checkIns?.length) {
    await admin
      .from("bookings")
      .update({ checkin_reminder_sent_at: new Date().toISOString() })
      .in("id", checkIns.map(b => b.id));
  }

  // ── Expiry reminders (unpaid bookings expiring within 24h) ──
  const in24h = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: expiring } = await admin
    .from("bookings")
    .select("id, booking_code, user_id, expires_at, bank_transfer_code, total_price, property:properties(name)")
    .eq("payment_status", "unpaid")
    .not("status", "in", '("confirmed","cancelled","expired")')
    .not("expires_at", "is", null)
    .gt("expires_at", today.toISOString())
    .lt("expires_at", in24h)
    .is("expiry_reminder_sent_at", null);

  if (expiring?.length) {
    await admin
      .from("bookings")
      .update({ expiry_reminder_sent_at: new Date().toISOString() })
      .in("id", expiring.map(b => b.id));
  }

  console.log(`[send-reminders] checkin=${checkIns?.length ?? 0} expiry=${expiring?.length ?? 0}`);

  // Return the payloads — pipe these to your notification provider
  return NextResponse.json({
    checkInReminders:  checkIns  ?? [],
    expiryReminders:   expiring  ?? [],
  });
}
