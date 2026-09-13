import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_unpaid_bookings");

  if (error) {
    console.error("[expire-bookings]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[expire-bookings] expired=${data}`);
  return NextResponse.json({ expired: data });
}
