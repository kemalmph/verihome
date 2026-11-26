import { requirePermission } from "@/lib/auth/guards";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  try { await requirePermission("listings.manage"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { propertyId, videoUrl } = (await req.json()) as { propertyId: string; videoUrl: string | null };
  if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });

  // Upsert into property_media.video_url
  const { data: existing } = await admin
    .from("property_media")
    .select("id")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    await admin.from("property_media").update({ video_url: videoUrl }).eq("id", existing.id);
  } else {
    await admin.from("property_media").insert({ property_id: propertyId, video_url: videoUrl });
  }

  return NextResponse.json({ success: true });
}
