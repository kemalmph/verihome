import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cron: cancel bookings that have been pending (unpaid) for more than 24 hours.
// Called by Vercel Cron — protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin  = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find pending+unpaid bookings older than 24h
  const { data: expired } = await admin
    .from("bookings")
    .select("id")
    .eq("status", "pending")
    .eq("payment_status", "unpaid")
    .lt("created_at", cutoff);

  if (!expired || expired.length === 0) {
    return NextResponse.json({ cancelled: 0 });
  }

  const ids = expired.map((b) => b.id);

  // Cancel bookings
  await admin
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .in("id", ids);

  // Free up availability blocks
  await admin
    .from("availability_blocks")
    .delete()
    .in("booking_id", ids);

  return NextResponse.json({ cancelled: ids.length });
}
