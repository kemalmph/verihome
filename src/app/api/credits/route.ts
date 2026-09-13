import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/credits — return user's available credits and total balance
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_credits")
    .select("id, amount, reason, expires_at, redeemed_at, booking_id, created_at")
    .eq("user_id", user.id)
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const available = (data ?? []).filter(
    c => !c.redeemed_at && (!c.expires_at || new Date(c.expires_at) > new Date())
  );
  const balance = available.reduce((s, c) => s + Number(c.amount), 0);

  return NextResponse.json({ credits: data, available, balance });
}
