import { NextRequest, NextResponse } from "next/server";
import { completeDueBookings } from "@/lib/cron/steps";

// Kept as a standalone endpoint so it can be run on its own, but the work now
// lives in lib/cron/steps and is also one step of /api/cron/daily.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await completeDueBookings();
  return NextResponse.json(result);
}
