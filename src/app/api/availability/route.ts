import { NextRequest, NextResponse } from "next/server";
import { getUnavailableDates, calculatePrice, validateStayRules } from "@/lib/availability";

// GET /api/availability?propertyId=xxx
// GET /api/availability?propertyId=xxx&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const checkIn    = searchParams.get("checkIn");
  const checkOut   = searchParams.get("checkOut");

  if (!propertyId) {
    return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
  }

  // If dates provided, return a price quote + availability check
  if (checkIn && checkOut) {
    const inDate  = new Date(checkIn  + "T00:00:00Z");
    const outDate = new Date(checkOut + "T00:00:00Z");

    const [validation, quote] = await Promise.all([
      validateStayRules(propertyId, inDate, outDate),
      calculatePrice(propertyId, inDate, outDate),
    ]);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    return NextResponse.json({ quote });
  }

  // Otherwise return all unavailable dates
  const unavailable = await getUnavailableDates(propertyId);
  return NextResponse.json({ unavailable });
}
