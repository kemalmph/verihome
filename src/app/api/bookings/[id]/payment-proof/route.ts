import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2, sanitizeFilename } from "@/lib/r2/upload";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify the booking belongs to this user and is still awaiting payment
  const { data: booking } = await admin
    .from("bookings")
    .select("id, user_id, status, payment_status")
    .eq("id", id)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.payment_status === "paid") {
    return NextResponse.json({ error: "Booking is already paid" }, { status: 409 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "File must be JPEG, PNG, WebP, or PDF" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 10 MB" }, { status: 400 });
  }

  const safe = sanitizeFilename(file.name);
  const key  = `payment-proofs/bookings/${id}/${Date.now()}-${safe}`;
  const url  = await uploadToR2(Buffer.from(bytes), key, file.type);

  const { data: updated, error } = await admin
    .from("bookings")
    .update({
      payment_proof_url: url,
      payment_status:    "pending_verification",
      status:            "awaiting_verification",
      updated_at:        new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ booking: updated, url }, { status: 200 });
}
