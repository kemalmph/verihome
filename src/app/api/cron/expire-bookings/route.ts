import { NextRequest, NextResponse } from "next/server";
import { expireStaleBookings } from "@/lib/cron/steps";

// Kept runnable on its own; the scheduled path is /api/cron/daily.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await expireStaleBookings());
}
