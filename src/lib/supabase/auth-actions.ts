"use server";

import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) throw error;
  if (data.url) redirect(data.url);
}

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUpWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) return { error: error.message };

  return { success: "Check your email to confirm your account." };
}

export async function sendOtp(formData: FormData) {
  const phone = formData.get("phone") as string;
  const supabase = await createClient();

  // Normalize: ensure +62 prefix
  const normalized = phone.startsWith("+") ? phone : `+62${phone.replace(/^0/, "")}`;

  const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
  if (error) return { error: error.message };

  return { success: true, phone: normalized };
}

export async function verifyOtp(formData: FormData) {
  const phone = formData.get("phone") as string;
  const token = formData.get("token") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
