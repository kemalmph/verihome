import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFromR2, keyFromUrl } from "@/lib/r2/upload";
import type { PhotoCategory } from "@/types/property";

const CATEGORY_COLUMN: Record<PhotoCategory, string> = {
  exterior:    "photos_exterior",
  common_area: "photos_common_area",
  unit:        "photos_unit",
  bathroom:    "photos_bathroom",
};

export async function DELETE(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { url, propertyId, category } = (await req.json()) as {
    url: string;
    propertyId: string;
    category: PhotoCategory;
  };

  if (!url || !propertyId || !category || !CATEGORY_COLUMN[category]) {
    return NextResponse.json({ error: "Missing url, propertyId, or category" }, { status: 400 });
  }

  // Delete from R2
  const key = keyFromUrl(url);
  await deleteFromR2(key);

  // Remove URL from the array in property_media
  const col = CATEGORY_COLUMN[category];
  const { data: existingRaw } = await admin
    .from("property_media")
    .select("id, photos_exterior, photos_common_area, photos_unit, photos_bathroom")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existingRaw) {
    const existingTyped = existingRaw as {
      id: string;
      photos_exterior: string[];
      photos_common_area: string[];
      photos_unit: string[];
      photos_bathroom: string[];
    };
    const current: string[] = (existingTyped[col as keyof typeof existingTyped] as string[]) ?? [];
    const updatedArr = current.filter((u) => u !== url);
    await admin
      .from("property_media")
      .update({ [col]: updatedArr })
      .eq("id", existingTyped.id);
  }

  // Re-fetch total and update checklist
  const { data: refreshed } = await admin
    .from("property_media")
    .select("total_photo_count")
    .eq("property_id", propertyId)
    .maybeSingle();

  const totalCount = refreshed?.total_photo_count ?? 0;
  await admin
    .from("publish_checklist")
    .upsert(
      { property_id: propertyId, min_photos_uploaded: totalCount >= 15 },
      { onConflict: "property_id" }
    );

  return NextResponse.json({ success: true, totalCount });
}
