import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/guards";
import type { Permission } from "@/lib/auth/permissions";
import { presignedGetUrl } from "@/lib/r2/private";

// GET /api/bookings/[id]/payment-proof-url
// Returns a 15-minute presigned GET URL for the payment proof.
// Accessible only to the booking owner or an admin.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: booking }, viewer] = await Promise.all([
    admin.from("bookings").select("user_id, payment_proof_url").eq("id", id).single(),
    getViewer(),
  ]);

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const staffRead = !!viewer && ["bookings.operate", "payments.settle", "finance.view"]
    .some((p) => viewer.permissions.includes(p as Permission));
  if (!staffRead && booking.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!booking.payment_proof_url) {
    return NextResponse.json({ error: "No proof uploaded yet" }, { status: 404 });
  }

  const url = await presignedGetUrl(booking.payment_proof_url);
  return NextResponse.json({ url, expiresIn: 900 });
}
