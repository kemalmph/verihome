import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "crypto";
import { parseTallyFields, writeSurvey, type TallyField } from "@/lib/survey/import";

// Tally webhook intake.
//
// This is the remote alternative to the in-platform surveyor form at
// /admin/listings/[id]/survey. Both write through writeSurvey(); the only work
// unique to this path is mapping free-text field labels and deciding which
// property an anonymous submission belongs to.

function findField(fields: TallyField[], ...fragments: string[]): string {
  const field = fields.find((f) =>
    fragments.some((frag) => f.label.toLowerCase().includes(frag.toLowerCase()))
  );
  const v = field?.value;
  return typeof v === "string" ? v.trim() : "";
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

async function verifySignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.TALLY_SIGNING_SECRET;

  // No secret configured means no Tally form is wired up yet. The endpoint stays
  // open so the integration can be tested before the secret exists — set
  // TALLY_SIGNING_SECRET *before* pointing a live form at this URL.
  if (!secret) return true;

  const signature = req.headers.get("tally-signature") ?? "";
  const expected  = createHmac("sha256", secret).update(body).digest("hex");

  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// POST /api/admin/surveys/import — Tally webhook
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

  // survey_import_log doubles as the replay guard
  const { data: existing } = await admin
    .from("survey_import_log")
    .select("id")
    .eq("tally_submission_id", submissionId)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const propertyNameText = findField(fields, "nama properti", "property name");

  // Auto-import only on an unambiguous name match — a wrong guess would write
  // assessment data onto someone else's property.
  const { data: matches } = await admin
    .from("properties")
    .select("id, name")
    .ilike("name", propertyNameText)
    .limit(2);

  const confident         = matches?.length === 1;
  const matchedPropertyId = confident ? matches![0].id : null;

  if (confident && matchedPropertyId) {
    try {
      await writeSurvey(matchedPropertyId, parseTallyFields(fields));

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
