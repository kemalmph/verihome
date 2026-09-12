import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cron: mark confirmed bookings as completed once check-out date has passed.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: toComplete } = await admin
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .lte("check_out_date", today);

  if (!toComplete || toComplete.length === 0) {
    return NextResponse.json({ completed: 0 });
  }

  const ids = toComplete.map((b) => b.id);

  await admin
    .from("bookings")
    .update({ status: "completed" })
    .in("id", ids);

  return NextResponse.json({ completed: ids.length });
}
