import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFilename } from "@/lib/r2/upload";
import { uploadPrivate } from "@/lib/r2/private";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED   = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// POST /api/bookings/[id]/payment-proof
// Accepts multipart file, uploads to private R2 bucket (never publicly accessible),
// stores the object key (not a URL) in payment_proof_url, sets status to
// awaiting_verification. The file is served only via the /payment-proof-url
// endpoint which generates a 15-min presigned GET URL for owners and admins.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select("id, user_id, payment_status")
    .eq("id", id)
    .single();

  if (!booking)                          return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.user_id !== user.id)       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.payment_status === "paid") return NextResponse.json({ error: "Booking is already paid" }, { status: 409 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "File must be JPEG, PNG, WebP, or PDF" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: "File must be under 10 MB" }, { status: 400 });

  const key = `payment-proofs/bookings/${id}/${Date.now()}-${sanitizeFilename(file.name)}`;
  await uploadPrivate(Buffer.from(bytes), key, file.type);

  const { data: updated, error } = await admin
    .from("bookings")
    .update({
      payment_proof_url: key,           // object key, not a public URL
      payment_status:    "pending_verification",
      status:            "awaiting_verification",
      updated_at:        new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ booking: updated }, { status: 200 });
}
