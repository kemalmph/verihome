"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

function parseLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.min(Math.max(Math.round(n), 0), 10);
}

export async function saveBuildListing(propertyId: string, formData: FormData) {
  const admin = createAdminClient();

  // ── 1. Basic property fields ─────────────────────────────────────────────
  const name          = (formData.get("name") as string)?.trim();
  const area          = formData.get("area") as string;
  const address       = (formData.get("address") as string)?.trim() || null;
  const property_type = formData.get("property_type") as string;
  const price_monthly = parseInt(formData.get("price_monthly") as string) || null;
  const bedrooms      = parseInt(formData.get("bedrooms") as string) || null;
  const bathrooms     = parseInt(formData.get("bathrooms") as string) || null;
  const size_sqm      = parseFloat(formData.get("size_sqm") as string) || null;
  const min_stay_months = parseInt(formData.get("min_stay_months") as string) || 1;
  const google_maps_url = (formData.get("google_maps_url") as string)?.trim() || null;

  await admin.from("properties").update({
    name, area, address, property_type, price_monthly, bedrooms,
    bathrooms, size_sqm, min_stay_months, google_maps_url,
    status: "draft",
  }).eq("id", propertyId);

  // ── 2. RLA assessment ────────────────────────────────────────────────────
  const rlaPayload = {
    property_id:        propertyId,
    building_condition: num(formData.get("building_condition")),
    natural_lighting:   num(formData.get("natural_lighting")),
    ventilation:        num(formData.get("ventilation")),
    noise_level:        num(formData.get("noise_level")),
    cleanliness:        num(formData.get("cleanliness")),
    security_level:     num(formData.get("security_level")),
    bathroom_condition: num(formData.get("bathroom_condition")),
    furniture_quality:  num(formData.get("furniture_quality")),
    pros:               parseLines(formData.get("pros") as string ?? ""),
    cons:               parseLines(formData.get("cons") as string ?? ""),
    overall_notes:      (formData.get("overall_notes") as string)?.trim() || null,
  };

  const { data: existingRLA } = await admin
    .from("rla_assessments")
    .select("id")
    .eq("property_id", propertyId)
    .is("survey_id", null)   // only touch manually-created rows
    .limit(1)
    .single();

  if (existingRLA) {
    await admin.from("rla_assessments").update(rlaPayload).eq("id", existingRLA.id);
  } else {
    await admin.from("rla_assessments").insert(rlaPayload);
  }

  // ── 3. Area overview ─────────────────────────────────────────────────────
  const neighborhoodRaw = (formData.get("neighborhood_character") as string) ?? "mixed";
  const areaPayload = {
    property_id:              propertyId,
    nearest_mrt:              (formData.get("nearest_mrt") as string)?.trim() || null,
    mrt_distance:             (formData.get("mrt_distance") as string)?.trim() || null,
    nearest_transjakarta:     (formData.get("nearest_transjakarta") as string)?.trim() || null,
    transjakarta_distance:    (formData.get("transjakarta_distance") as string)?.trim() || null,
    nearest_minimarket:       (formData.get("nearest_minimarket") as string)?.trim() || null,
    nearest_clinic:           (formData.get("nearest_clinic") as string)?.trim() || null,
    nearest_food:             (formData.get("nearest_food") as string)?.trim() || null,
    nearest_gym:              (formData.get("nearest_gym") as string)?.trim() || null,
    neighborhood_character:   neighborhoodRaw || "mixed",
    expat_friendly:           num(formData.get("expat_friendly")) ?? 5,
    time_to_scbd_min:         parseInt(formData.get("time_to_scbd_min") as string) || null,
    time_to_sudirman_min:     parseInt(formData.get("time_to_sudirman_min") as string) || null,
    area_notes:               (formData.get("area_notes") as string)?.trim() || null,
  };

  const { data: existingArea } = await admin
    .from("area_overviews")
    .select("id")
    .eq("property_id", propertyId)
    .limit(1)
    .single();

  if (existingArea) {
    await admin.from("area_overviews").update(areaPayload).eq("id", existingArea.id);
  } else {
    await admin.from("area_overviews").insert(areaPayload);
  }

  // ── 4. Property details ──────────────────────────────────────────────────
  const detailsPayload = {
    property_id:       propertyId,
    facilities:        parseLines(formData.get("facilities") as string ?? ""),
    included_utilities: parseLines(formData.get("included_utilities") as string ?? ""),
    rules:             (formData.get("rules") as string)?.trim() || null,
    additional_notes:  (formData.get("additional_notes") as string)?.trim() || null,
  };

  const { data: existingDetails } = await admin
    .from("property_details")
    .select("id")
    .eq("property_id", propertyId)
    .limit(1)
    .single();

  if (existingDetails) {
    await admin.from("property_details").update(detailsPayload).eq("id", existingDetails.id);
  } else {
    await admin.from("property_details").insert(detailsPayload);
  }

  // ── 5. Publish checklist ─────────────────────────────────────────────────
  await admin.from("publish_checklist").upsert(
    { property_id: propertyId, rla_completed: true, area_overview_filled: true },
    { onConflict: "property_id" }
  );

  revalidatePath(`/admin/listings/${propertyId}`);
  revalidatePath(`/admin/listings/${propertyId}/build`);
  revalidatePath("/admin/listings");
  return { success: true };
}
