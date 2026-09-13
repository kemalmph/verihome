import { createAdminClient } from "@/lib/supabase/admin";

// Shared survey ingestion core.
//
// Two front doors converge here: the Tally webhook (which must first map free-text
// field labels onto this shape) and the in-platform surveyor form (which produces
// it directly). Keeping the writer in one place means the two intake paths cannot
// drift apart in what they store.

export type TallyField = {
  key: string;
  label: string;
  type: string;
  value: unknown;
};

export interface SurveyPayload {
  survey_date:           string;
  surveyor_name:         string;
  pic_name:              string;
  pic_whatsapp:          string;
  duration_minutes:      number | null;
  video_walkthrough_url: string | null;

  scores: {
    building_condition: number | null;
    natural_lighting:   number | null;
    ventilation:        number | null;
    noise_level:        number | null;
    cleanliness:        number | null;
    security_level:     number | null;
    bathroom_condition: number | null;
    furniture_quality:  number | null;
  };
  pros:          string[];
  cons:          string[];
  overall_notes: string | null;

  area: {
    nearest_mrt:              string | null;
    mrt_distance:             string | null;
    walk_time_to_transit_min: number | null;
    nearest_transjakarta:     string | null;
    transjakarta_distance:    string | null;
    nearest_minimarket:       string | null;
    nearest_clinic:           string | null;
    nearest_food:             string | null;
    nearest_gym:              string | null;
    neighborhood_character:   string;
    expat_friendly:           number;
    area_notes:               string | null;
  };
}

export const NEIGHBOURHOOD_CHARACTERS = ["quiet", "mixed", "busy"] as const;

export function parseTextList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

/** RLA dimensions are a 0-10 scale. */
export function clampScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.min(Math.max(Math.round(n), 0), 10);
}

/** Durations and walking times are plain minutes — never clamped to the score range. */
export function parseMinutes(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) || n < 0 ? null : Math.round(n);
}

// ── Tally label mapping ──────────────────────────────────────────────────────
// Tally sends human labels rather than stable keys, so fields are matched on
// substrings, Indonesian first with an English fallback.

function findField(fields: TallyField[], ...fragments: string[]): string {
  const field = fields.find((f) =>
    fragments.some((frag) => f.label.toLowerCase().includes(frag.toLowerCase()))
  );
  const v = field?.value;
  return typeof v === "string" ? v.trim() : "";
}

function findRaw(fields: TallyField[], ...fragments: string[]): unknown {
  return fields.find((f) =>
    fragments.some((frag) => f.label.toLowerCase().includes(frag.toLowerCase()))
  )?.value;
}

export function parseTallyFields(fields: TallyField[]): SurveyPayload {
  const neighbourhoodRaw = findField(fields, "karakter lingkungan", "neighborhood").toLowerCase();
  const neighbourhoodMap: Record<string, string> = {
    tenang: "quiet", quiet: "quiet",
    ramai:  "busy",  busy:  "busy",
    mixed:  "mixed",
  };

  return {
    survey_date:           findField(fields, "tanggal", "date") || new Date().toISOString().slice(0, 10),
    surveyor_name:         findField(fields, "nama surveyor", "surveyor"),
    pic_name:              findField(fields, "nama pic", "pic name"),
    pic_whatsapp:          findField(fields, "wa pic", "whatsapp pic", "phone pic"),
    duration_minutes:      parseMinutes(findRaw(fields, "durasi", "duration")),
    video_walkthrough_url: findField(fields, "video", "walkthrough url") || null,

    scores: {
      building_condition: clampScore(findRaw(fields, "kondisi bangunan", "building")),
      natural_lighting:   clampScore(findRaw(fields, "pencahayaan", "lighting")),
      ventilation:        clampScore(findRaw(fields, "ventilasi", "ventilation")),
      noise_level:        clampScore(findRaw(fields, "kebisingan", "noise")),
      cleanliness:        clampScore(findRaw(fields, "kebersihan", "cleanliness")),
      security_level:     clampScore(findRaw(fields, "keamanan", "security")),
      bathroom_condition: clampScore(findRaw(fields, "kamar mandi", "bathroom")),
      furniture_quality:  clampScore(findRaw(fields, "furnitur", "furniture")),
    },
    pros:          parseTextList(findField(fields, "kelebihan", "pros", "keunggulan")),
    cons:          parseTextList(findField(fields, "kekurangan", "cons", "kelemahan")),
    overall_notes: findField(fields, "catatan", "notes", "overall") || null,

    area: {
      nearest_mrt:              findField(fields, "mrt terdekat", "nearest mrt") || null,
      mrt_distance:             findField(fields, "jarak mrt", "mrt distance") || null,
      walk_time_to_transit_min: parseMinutes(findRaw(fields, "jalan kaki", "walk time")),
      nearest_transjakarta:     findField(fields, "transjakarta", "transj") || null,
      transjakarta_distance:    findField(fields, "jarak transjakarta") || null,
      nearest_minimarket:       findField(fields, "minimarket") || null,
      nearest_clinic:           findField(fields, "klinik", "clinic") || null,
      nearest_food:             findField(fields, "tempat makan", "makanan", "food") || null,
      nearest_gym:              findField(fields, "gym", "fitness") || null,
      neighborhood_character:   neighbourhoodMap[neighbourhoodRaw] ?? "mixed",
      expat_friendly:           clampScore(findRaw(fields, "expat", "ramah expat")) ?? 5,
      area_notes:               findField(fields, "catatan area", "area notes") || null,
    },
  };
}

// ── Writer ───────────────────────────────────────────────────────────────────

/**
 * Records one site visit against a property: the visit itself, its RLA scores,
 * its area overview, and the checklist flags those satisfy.
 * Returns the new property_surveys id.
 */
export async function writeSurvey(
  propertyId: string,
  payload: SurveyPayload
): Promise<string> {
  const admin = createAdminClient();

  const { data: survey, error: surveyErr } = await admin
    .from("property_surveys")
    .insert({
      property_id:           propertyId,
      survey_date:           payload.survey_date,
      surveyor_name:         payload.surveyor_name,
      pic_name:              payload.pic_name,
      pic_whatsapp:          payload.pic_whatsapp,
      duration_minutes:      payload.duration_minutes,
      video_walkthrough_url: payload.video_walkthrough_url,
    })
    .select("id")
    .single();

  if (surveyErr || !survey) throw new Error(`survey insert failed: ${surveyErr?.message}`);
  const surveyId = survey.id;

  const { error: rlaErr } = await admin.from("rla_assessments").insert({
    property_id: propertyId,
    survey_id:   surveyId,
    ...payload.scores,
    pros:          payload.pros,
    cons:          payload.cons,
    overall_notes: payload.overall_notes,
  });
  if (rlaErr) throw new Error(`rla insert failed: ${rlaErr.message}`);

  const { error: areaErr } = await admin.from("area_overviews").insert({
    property_id: propertyId,
    survey_id:   surveyId,
    ...payload.area,
  });
  if (areaErr) throw new Error(`area insert failed: ${areaErr.message}`);

  // Placeholder media row only when the property has none. property_media has no
  // unique constraint, and readers take the first row — an unconditional insert
  // on a re-survey could shadow a row that already holds uploaded photos.
  const { count } = await admin
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  if (!count) {
    await admin.from("property_media").insert({
      property_id:  propertyId,
      survey_id:    surveyId,
      media_status: "pending",
    });
  }

  await admin.from("publish_checklist").upsert(
    { property_id: propertyId, rla_completed: true, area_overview_filled: true },
    { onConflict: "property_id" }
  );

  return surveyId;
}
