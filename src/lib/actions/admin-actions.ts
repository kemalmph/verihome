"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { postConsultationPaymentReceived, postConsultationRevenueEarned } from "@/lib/ledger/events";

export async function updatePropertyStatus(propertyId: string, status: string) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();
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

  const { error } = await admin
    .from("consultations")
    .update({ status })
    .eq("id", consultationId);
  if (error) return { error: error.message };

  // Cash received is the package price less any credit applied.
  const amount =
    Number(before?.final_price ?? before?.price ?? 0) - Number(before?.credit_applied ?? 0);

  let ledgerError: string | null = null;
  try {
    // 'paid' is the admin confirming the transfer arrived.
    if (before && before.status !== "paid" && status === "paid") {
      await postConsultationPaymentReceived(
        { id: before.id, user_id: before.user_id, amount },
        { createdBy: caller.id }
      );
    }
    // 'completed' is the session actually delivered — only then is it revenue.
    if (before && before.status !== "completed" && status === "completed") {
      await postConsultationRevenueEarned(
        { id: before.id, user_id: before.user_id, amount },
        { createdBy: caller.id }
      );
    }
  } catch (err) {
    ledgerError = (err as Error).message;
    console.error("[updateConsultationStatus] ledger:", ledgerError);
  }

  revalidatePath("/admin/consultations");
  return { success: true, ledgerError };
}
