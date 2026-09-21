import { NextRequest, NextResponse } from "next/server";
import { runDailyJobs } from "@/lib/cron/dispatcher";

// The single scheduled entry point. Vercel Hobby allows one run per day, so all
// scheduled work happens here in a fixed order.
//
// Scheduled "0 0 * * *" — Vercel cron is UTC, so that is 07:00 WIB.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyJobs();

  // 200 even when steps failed: the dispatcher itself worked, and the body says
  // what happened. A non-200 would hide which steps succeeded.
  return NextResponse.json(result);
}
