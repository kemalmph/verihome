"use server";

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { defaultLanding } from "@/lib/nav/server";

export async function signInWithGoogle(redirectTo = "/account") {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Same destination handling as email sign-in, so an OAuth round trip
      // started mid-booking comes back to the booking.
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (error) throw error;
  if (data.url) redirect(data.url);
}

/**
 * `redirectTo` empty means the caller has no destination of its own, so the
 * person goes to the first page they actually have: staff to the first item of
 * their menu, an active property owner to /owner, anyone else to /account.
 * An explicit destination (a booking they were in the middle of) always wins.
 */
export async function signInWithEmail(formData: FormData, redirectTo = "") {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(redirectTo || (await defaultLanding()));
}

export async function signUpWithEmail(formData: FormData, redirectTo = "/account") {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      // Carry the destination through the confirmation email. Without this the
      // link lands on /account and a guest who signed up midway through a
      // booking has to find their way back to it themselves.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  });
  if (error) return { error: error.message };

  // A session comes back only when "Confirm email" is off. Branch on what
  // actually arrived rather than on an assumption about the project setting,
  // so this stays correct whichever way that toggle is set.
  if (data.session) redirect(redirectTo);

  return {
    success: `Check ${email} to confirm your account. The link brings you straight back here.`,
  };
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

  redirect("/account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
