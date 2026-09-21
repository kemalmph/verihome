"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";


/** The checklist items, and what to call each one when it is missing. */
const CHECKLIST_ITEMS: [key: string, label: string][] = [
  ["min_photos_uploaded",    "Foto belum cukup"],
  ["video_walkthrough_done", "Video walkthrough belum ada"],
  ["rla_completed",          "Penilaian RLA belum lengkap"],
  ["pros_cons_written",      "Kelebihan dan kekurangan belum ditulis"],
  ["price_verified",         "Harga belum diverifikasi"],
  ["owner_contact_active",   "Kontak pemilik belum dikonfirmasi"],
  ["area_overview_filled",   "Data area belum diisi"],
  ["rental_mode_configured", "Mode sewa belum diatur"],
];

export async function updatePropertyStatus(propertyId: string, status: string) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();

  // The checklist is written diligently by three subsystems and, until now, read
  // by nothing — a property could go live with no photos, no rate and no
  // assessment. Enforced in the action rather than the UI, because a layout or a
  // disabled button is not a rule: this function is separately callable.
  if (status === "live") {
    const { data: checklist } = await admin
      .from("publish_checklist")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!checklist) {
      return { error: "Checklist publikasi belum ada untuk properti ini — lengkapi Build Listing dulu." };
    }

    const unmet = CHECKLIST_ITEMS
      .filter(([key]) => (checklist as Record<string, unknown>)[key] !== true)
      .map(([, label]) => label);

    if (unmet.length > 0) {
      // Name what is missing. "Checklist incomplete" tells nobody what to do.
      return {
        error: `Belum bisa dipublikasikan. ${unmet.length} item belum selesai: ${unmet.join("; ")}.`,
        unmet,
      };
    }
  }

  const { error } = await admin
    .from("properties")
    .update({ status })
    .eq("id", propertyId);
  if (error) return { error: error.message };
  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  return { success: true };
}

export async function updatePropertyDetails(propertyId: string, formData: FormData) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();

  const name = (formData.get("name") as string).trim();
  const area = formData.get("area") as string;
  const property_type = formData.get("property_type") as string;
  const price_monthly = parseInt(formData.get("price_monthly") as string);
  const bedrooms = parseInt(formData.get("bedrooms") as string);
  const bathrooms = parseInt(formData.get("bathrooms") as string);
  const size_sqm = parseFloat(formData.get("size_sqm") as string) || null;
  const address = (formData.get("address") as string).trim();
  const status = formData.get("status") as string;
  const min_stay_months = parseInt(formData.get("min_stay_months") as string) || 1;

  const { error } = await admin
    .from("properties")
    .update({ name, area, property_type, price_monthly, bedrooms, bathrooms, size_sqm, address, status, min_stay_months })
    .eq("id", propertyId);

  if (error) return { error: error.message };
  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteProperty(propertyId: string) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();
  const { error } = await admin.from("properties").delete().eq("id", propertyId);
  if (error) return { error: error.message };
  revalidatePath("/admin/listings");
  return { success: true };
}

export async function updateConsultationStatus(consultationId: string, status: string) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();

  // Prior state decides which money event this is, and it is unrecoverable
  // once the row is written.
  const { data: before } = await admin
    .from("consultations")
    .select("id, user_id, status, price, final_price, credit_applied")
    .eq("id", consultationId)
    .single();

  // Money transitions go through settlement functions: the status change and
  // the ledger entries commit together, or neither does. The amounts are
  // computed in the database from the row itself, so the two cannot disagree
  // about what a session was worth.
  let ledgerError: string | null = null;
  try {
    if (before && before.status !== "paid" && status === "paid") {
      const { error: e } = await admin.rpc("settle_consultation_payment", {
        p_consultation_id: consultationId, p_actor: caller.id,
      });
      if (e) throw new Error(e.message);
    } else if (before && before.status !== "completed" && status === "completed") {
      const { error: e } = await admin.rpc("settle_consultation_completion", {
        p_consultation_id: consultationId, p_actor: caller.id,
      });
      if (e) throw new Error(e.message);
    } else {
      // No money attached — a plain status change.
      const { error: e } = await admin
        .from("consultations").update({ status }).eq("id", consultationId);
      if (e) return { error: e.message };
    }
  } catch (err) {
    ledgerError = (err as Error).message;
    console.error("[updateConsultationStatus]:", ledgerError);
    return { error: ledgerError };
  }

  revalidatePath("/admin/consultations");
  return { success: true, ledgerError };
}
