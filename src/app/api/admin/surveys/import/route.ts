import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "crypto";

// ---------------------------------------------------------------------------
// Tally field-label → schema mapping helpers
// ---------------------------------------------------------------------------

type TallyField = {
  key: string;
  label: string;
  type: string;
  value: unknown;
};

function findField(fields: TallyField[], ...labelFragments: string[]): string {
  const field = fields.find((f) =>
    labelFragments.some((frag) => f.label.toLowerCase().includes(frag.toLowerCase()))
  );
  const v = field?.value;
  return typeof v === "string" ? v.trim() : "";
}

function findNumber(fields: TallyField[], ...labelFragments: string[]): number | null {
  const field = fields.find((f) =>
    labelFragments.some((frag) => f.label.toLowerCase().includes(frag.toLowerCase()))
  );
  const v = field?.value;
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.min(Math.max(Math.round(n), 0), 10);
}

function parseTextList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Verify Tally HMAC-SHA256 signature (if signing secret is configured)
// ---------------------------------------------------------------------------

async function verifySignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.TALLY_SIGNING_SECRET;
  if (!secret) return true; // skip verification when no secret is set

  const signature = req.headers.get("tally-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return signature === expected;
}

// ---------------------------------------------------------------------------
// Core import logic (shared with the admin manual-link flow)
// ---------------------------------------------------------------------------

export async function importSurveyPayload(
  submissionId: string,
  fields: TallyField[],
  propertyId: string
) {
  const admin = createAdminClient();

  // 1. property_surveys
  const { data: survey, error: surveyErr } = await admin
    .from("property_surveys")
    .insert({
      property_id:          propertyId,
      survey_date:          findField(fields, "tanggal", "date") || new Date().toISOString().split("T")[0],
      surveyor_name:        findField(fields, "nama surveyor", "surveyor"),
      pic_name:             findField(fields, "nama pic", "pic name"),
      pic_whatsapp:         findField(fields, "wa pic", "whatsapp pic", "phone pic"),
      duration_minutes:     findNumber(fields, "durasi", "duration") ?? null,
      video_walkthrough_url: findField(fields, "video", "walkthrough url") || null,
    })
    .select("id")
    .single();

  if (surveyErr || !survey) throw new Error(`survey insert failed: ${surveyErr?.message}`);
  const surveyId = survey.id;

  // 2. rla_assessments
  const prosRaw = findField(fields, "kelebihan", "pros", "keunggulan");
  const consRaw = findField(fields, "kekurangan", "cons", "kelemahan");
  await admin.from("rla_assessments").insert({
    property_id:       propertyId,
    survey_id:         surveyId,
    building_condition: findNumber(fields, "kondisi bangunan", "building"),
    natural_lighting:   findNumber(fields, "pencahayaan", "lighting"),
    ventilation:        findNumber(fields, "ventilasi", "ventilation"),
    noise_level:        findNumber(fields, "kebisingan", "noise"),
    cleanliness:        findNumber(fields, "kebersihan", "cleanliness"),
    security_level:     findNumber(fields, "keamanan", "security"),
    bathroom_condition: findNumber(fields, "kamar mandi", "bathroom"),
    furniture_quality:  findNumber(fields, "furnitur", "furniture"),
    pros:               parseTextList(prosRaw),
    cons:               parseTextList(consRaw),
    overall_notes:      findField(fields, "catatan", "notes", "overall"),
  });

  // 3. area_overviews
  const neighborhoodRaw = findField(fields, "karakter lingkungan", "neighborhood").toLowerCase();
  const neighborhoodMap: Record<string, string> = {
    tenang: "quiet", quiet: "quiet",
    ramai: "busy",  busy: "busy",
    mixed: "mixed",
  };
  const neighborhood_character = neighborhoodMap[neighborhoodRaw] ?? "mixed";

  const expatRaw = findNumber(fields, "expat", "ramah expat");
  await admin.from("area_overviews").insert({
    property_id:             propertyId,
    survey_id:               surveyId,
    nearest_mrt:             findField(fields, "mrt terdekat", "nearest mrt"),
    mrt_distance:            findField(fields, "jarak mrt", "mrt distance"),
    walk_time_to_transit_min: findNumber(fields, "jalan kaki", "walk time") ?? null,
    nearest_transjakarta:    findField(fields, "transjakarta", "transj"),
    transjakarta_distance:   findField(fields, "jarak transjakarta"),
    nearest_minimarket:      findField(fields, "minimarket"),
    nearest_clinic:          findField(fields, "klinik", "clinic"),
    nearest_food:            findField(fields, "tempat makan", "makanan", "food"),
    nearest_gym:             findField(fields, "gym", "fitness"),
    neighborhood_character,
    expat_friendly:          expatRaw ?? 5,
    area_notes:              findField(fields, "catatan area", "area notes") || null,
  });

  // 4. property_media (placeholder row — actual photos uploaded separately)
  await admin.from("property_media").insert({
    property_id: propertyId,
    survey_id:   surveyId,
    media_status: "pending",
  });

  // 5. Update publish_checklist
  await admin
    .from("publish_checklist")
    .upsert(
      { property_id: propertyId, rla_completed: true, area_overview_filled: true },
      { onConflict: "property_id" }
    );

  return surveyId;
}

// ---------------------------------------------------------------------------
// POST /api/admin/surveys/import  — Tally webhook
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!(await verifySignature(req, body))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: {
    eventType?: string;
    data?: { submissionId?: string; fields?: TallyField[] };
  };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.eventType !== "FORM_RESPONSE") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const submissionId = payload.data?.submissionId ?? "";
  const fields       = payload.data?.fields ?? [];

  const admin = createAdminClient();

  // Guard against duplicate submissions
  const { data: existing } = await admin
    .from("survey_import_log")
    .select("id")
    .eq("tally_submission_id", submissionId)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const propertyNameText = findField(fields, "nama properti", "property name");

  // Fuzzy match: exact case-insensitive first, then ILIKE
  const { data: exactMatch } = await admin
    .from("properties")
    .select("id, name")
    .ilike("name", propertyNameText)
    .limit(2);

  const confident = exactMatch?.length === 1;
  const matchedPropertyId = confident ? exactMatch![0].id : null;

  if (confident && matchedPropertyId) {
    try {
      await importSurveyPayload(submissionId, fields, matchedPropertyId);

      await admin.from("survey_import_log").insert({
        tally_submission_id: submissionId,
        property_id:         matchedPropertyId,
        match_confidence:    "auto_matched",
        raw_payload:         JSON.parse(body),
      });
    } catch (err) {
      await admin.from("survey_import_log").insert({
        tally_submission_id: submissionId,
        property_id:         null,
        match_confidence:    "failed",
        raw_payload:         JSON.parse(body),
      });
      console.error("Tally import failed:", err);
      return NextResponse.json({ error: "import failed" }, { status: 500 });
    }
  } else {
    // No confident match — queue for manual linking
    await admin.from("pending_survey_imports").insert({
      tally_submission_id: submissionId,
      raw_payload:         JSON.parse(body),
      property_name_text:  propertyNameText,
    });

    await admin.from("survey_import_log").insert({
      tally_submission_id: submissionId,
      property_id:         null,
      match_confidence:    "manual_required",
      raw_payload:         JSON.parse(body),
    });
  }

  return NextResponse.json({ ok: true, matched: confident });
}
