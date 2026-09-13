import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2, sanitizeFilename } from "@/lib/r2/upload";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: viewing } = await admin
    .from("viewings")
    .select("id, user_id, deposit_paid, status")
    .eq("id", id)
    .single();

  if (!viewing) return NextResponse.json({ error: "Viewing not found" }, { status: 404 });
  if (viewing.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (viewing.deposit_paid) {
    return NextResponse.json({ error: "Deposit already recorded" }, { status: 409 });
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
  const key  = `payment-proofs/viewings/${id}/${Date.now()}-${safe}`;
  const url  = await uploadToR2(Buffer.from(bytes), key, file.type);

  const { data: updated, error } = await admin
    .from("viewings")
    .update({
      payment_proof_url: url,
      deposit_paid:      true,
      deposit_paid_at:   new Date().toISOString(),
      status:            "awaiting_confirmation",
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ viewing: updated, url }, { status: 200 });
}
