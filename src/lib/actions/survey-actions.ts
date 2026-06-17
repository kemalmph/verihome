"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { importSurveyPayload } from "@/app/api/admin/surveys/import/route";

type TallyField = {
  key: string;
  label: string;
  type: string;
  value: unknown;
};

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
    await importSurveyPayload(pending.tally_submission_id ?? pendingId, fields, propertyId);
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
