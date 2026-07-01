import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2, buildR2Key } from "@/lib/r2/upload";
import type { PhotoCategory } from "@/types/property";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const CATEGORY_COLUMN: Record<PhotoCategory, string> = {
  exterior:    "photos_exterior",
  common_area: "photos_common_area",
  unit:        "photos_unit",
  bathroom:    "photos_bathroom",
};

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Parse form data
  const form = await req.formData();
  const file       = form.get("file") as File | null;
  const propertyId = form.get("propertyId") as string | null;
  const category   = form.get("category") as PhotoCategory | null;

  if (!file || !propertyId || !category) {
    return NextResponse.json({ error: "Missing file, propertyId, or category" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `File type ${file.type} not allowed` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
  }
  if (!CATEGORY_COLUMN[category]) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Upload to R2
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildR2Key(propertyId, category, file.name);
  const url = await uploadToR2(buffer, key, file.type);

  // Upsert property_media and append URL to correct column
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
    const { error } = await admin
      .from("property_media")
      .update({ [col]: [...current, url] })
      .eq("id", existingTyped.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("property_media")
      .insert({ property_id: propertyId, [col]: [url] });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-fetch total count
  const { data: updated } = await admin
    .from("property_media")
    .select("total_photo_count")
    .eq("property_id", propertyId)
    .maybeSingle();

  const totalCount = updated?.total_photo_count ?? 0;

  // Update publish checklist
  await admin
    .from("publish_checklist")
    .upsert(
      { property_id: propertyId, min_photos_uploaded: totalCount >= 15 },
      { onConflict: "property_id" }
    );

  return NextResponse.json({ success: true, url, category, totalCount });
}
