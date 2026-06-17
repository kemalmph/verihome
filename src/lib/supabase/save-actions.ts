"use server";

import { createClient } from "./server";
import { revalidatePath } from "next/cache";

export async function toggleSave(propertyId: string, currentlySaved: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "unauthenticated" };

  if (currentlySaved) {
    const { error } = await supabase
      .from("saved_listings")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("saved_listings")
      .insert({ user_id: user.id, property_id: propertyId });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/saved");
  return { saved: !currentlySaved };
}

export async function getSavedPropertyIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("saved_listings")
    .select("property_id")
    .eq("user_id", user.id);

  return (data ?? []).map((r) => r.property_id as string);
}
