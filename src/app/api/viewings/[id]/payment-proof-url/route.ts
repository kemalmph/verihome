import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/guards";
import type { Permission } from "@/lib/auth/permissions";
import { presignedGetUrl } from "@/lib/r2/private";

// GET /api/viewings/[id]/payment-proof-url
// Returns a 15-minute presigned GET URL. Owner or admin only.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: viewing }, viewer] = await Promise.all([
    admin.from("viewings").select("user_id, payment_proof_url").eq("id", id).single(),
    getViewer(),
  ]);

  if (!viewing) return NextResponse.json({ error: "Viewing not found" }, { status: 404 });
  const staffRead = !!viewer && ["bookings.operate", "payments.settle", "finance.view"]
    .some((p) => viewer.permissions.includes(p as Permission));
  if (!staffRead && viewing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!viewing.payment_proof_url) {
    return NextResponse.json({ error: "No proof uploaded yet" }, { status: 404 });
  }

  const url = await presignedGetUrl(viewing.payment_proof_url);
  return NextResponse.json({ url, expiresIn: 900 });
}
