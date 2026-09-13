import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const [{ data: booking }, { data: profile }] = await Promise.all([
    admin.from("bookings").select("user_id, payment_proof_url").eq("id", id).single(),
    admin.from("users").select("is_admin").eq("id", user.id).single(),
  ]);

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!profile?.is_admin && booking.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!booking.payment_proof_url) {
    return NextResponse.json({ error: "No proof uploaded yet" }, { status: 404 });
  }

  const url = await presignedGetUrl(booking.payment_proof_url);
  return NextResponse.json({ url, expiresIn: 900 });
}
