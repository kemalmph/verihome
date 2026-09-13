import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch IDs only — the actual expiry happens inside expire_single_booking(),
  // one transaction per booking so each advisory lock is released immediately
  // rather than held for the duration of a bulk loop.
  const { data: expired, error: fetchError } = await admin
    .from("bookings")
    .select("id")
    .eq("payment_status", "unpaid")
    .not("status", "in", '("confirmed","cancelled","expired")')
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());

  if (fetchError) {
    console.error("[expire-bookings] fetch failed:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!expired?.length) {
    return NextResponse.json({ expired: 0 });
  }

  let count = 0;
  const errors: string[] = [];

  for (const { id } of expired) {
    const { data, error } = await admin.rpc("expire_single_booking", { p_booking_id: id });
    if (error) {
      errors.push(`${id}: ${error.message}`);
    } else if (data === true) {
      count++;
    }
  }

  if (errors.length) console.error("[expire-bookings] errors:", errors);
  console.log(`[expire-bookings] expired=${count} skipped=${expired.length - count - errors.length} errors=${errors.length}`);

  return NextResponse.json({ expired: count, errors: errors.length > 0 ? errors : undefined });
}
