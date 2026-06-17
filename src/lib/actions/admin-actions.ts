"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updatePropertyStatus(propertyId: string, status: string) {
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
  const admin = createAdminClient();
  const { error } = await admin.from("properties").delete().eq("id", propertyId);
  if (error) return { error: error.message };
  revalidatePath("/admin/listings");
  return { success: true };
}

export async function updateConsultationStatus(consultationId: string, status: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("consultations")
    .update({ status })
    .eq("id", consultationId);
  if (error) return { error: error.message };
  revalidatePath("/admin/consultations");
  return { success: true };
}
