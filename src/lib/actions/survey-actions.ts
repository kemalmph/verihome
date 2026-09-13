"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseTallyFields,
  writeSurvey,
  parseTextList,
  clampScore,
  parseMinutes,
  NEIGHBOURHOOD_CHARACTERS,
  type TallyField,
  type SurveyPayload,
} from "@/lib/survey/import";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) throw new Error("Admin access required.");
  return user;
}

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? "").trim();
}

/**
 * In-platform surveyor form. The property is known from the URL, so none of the
 * webhook's name-matching or manual-link queue applies here.
 */
export async function submitSurvey(propertyId: string, formData: FormData) {
  try {
    await requireAdmin();
  } catch (err) {
    return { error: (err as Error).message };
  }

  const surveyorName = text(formData, "surveyor_name");
  if (!surveyorName) return { error: "Surveyor name is required." };

  const character = text(formData, "neighborhood_character");

  const payload: SurveyPayload = {
    survey_date:           text(formData, "survey_date") || new Date().toISOString().slice(0, 10),
    surveyor_name:         surveyorName,
    pic_name:              text(formData, "pic_name"),
    pic_whatsapp:          text(formData, "pic_whatsapp"),
    duration_minutes:      parseMinutes(text(formData, "duration_minutes")),
    video_walkthrough_url: text(formData, "video_walkthrough_url") || null,

    scores: {
      building_condition: clampScore(text(formData, "building_condition")),
      natural_lighting:   clampScore(text(formData, "natural_lighting")),
      ventilation:        clampScore(text(formData, "ventilation")),
      noise_level:        clampScore(text(formData, "noise_level")),
      cleanliness:        clampScore(text(formData, "cleanliness")),
      security_level:     clampScore(text(formData, "security_level")),
      bathroom_condition: clampScore(text(formData, "bathroom_condition")),
      furniture_quality:  clampScore(text(formData, "furniture_quality")),
    },
    pros:          parseTextList(text(formData, "pros")),
    cons:          parseTextList(text(formData, "cons")),
    overall_notes: text(formData, "overall_notes") || null,

    area: {
      nearest_mrt:              text(formData, "nearest_mrt") || null,
      mrt_distance:             text(formData, "mrt_distance") || null,
      walk_time_to_transit_min: parseMinutes(text(formData, "walk_time_to_transit_min")),
      nearest_transjakarta:     text(formData, "nearest_transjakarta") || null,
      transjakarta_distance:    text(formData, "transjakarta_distance") || null,
      nearest_minimarket:       text(formData, "nearest_minimarket") || null,
      nearest_clinic:           text(formData, "nearest_clinic") || null,
      nearest_food:             text(formData, "nearest_food") || null,
      nearest_gym:              text(formData, "nearest_gym") || null,
      neighborhood_character:
        (NEIGHBOURHOOD_CHARACTERS as readonly string[]).includes(character) ? character : "mixed",
      expat_friendly:           clampScore(text(formData, "expat_friendly")) ?? 5,
      area_notes:               text(formData, "area_notes") || null,
    },
  };

  let surveyId: string;
  try {
    surveyId = await writeSurvey(propertyId, payload);
  } catch (err) {
    return { error: `Could not save the survey: ${(err as Error).message}` };
  }

  revalidatePath(`/admin/listings/${propertyId}`);
  revalidatePath(`/admin/listings/${propertyId}/build`);
  revalidatePath(`/admin/listings/${propertyId}/survey`);
  return { success: true, surveyId };
}

// ── Tally pending-import queue ───────────────────────────────────────────────

export async function linkPendingImport(pendingId: string, propertyId: string) {
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from("pending_survey_imports")
    .select("tally_submission_id, raw_payload")
    .eq("id", pendingId)
    .single();

  if (!pending) return { error: "Pending import not found." };

  const fields: TallyField[] =
    (pending.raw_payload as { data?: { fields?: TallyField[] } })?.data?.fields ?? [];

  try {
    await writeSurvey(propertyId, parseTallyFields(fields));
  } catch (err) {
    return { error: `Import failed: ${(err as Error).message}` };
  }

  await admin
    .from("pending_survey_imports")
    .update({ status: "linked", linked_property_id: propertyId })
    .eq("id", pendingId);

  await admin
    .from("survey_import_log")
    .update({ property_id: propertyId, match_confidence: "auto_matched" })
    .eq("tally_submission_id", pending.tally_submission_id ?? "");

  revalidatePath("/admin/surveys/pending");
  return { success: true };
}

export async function rejectPendingImport(pendingId: string) {
  const admin = createAdminClient();
  await admin
    .from("pending_survey_imports")
    .update({ status: "rejected" })
    .eq("id", pendingId);
  revalidatePath("/admin/surveys/pending");
  return { success: true };
}
