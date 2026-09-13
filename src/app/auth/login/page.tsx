import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { safeNext } from "@/lib/auth/safe-next";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

function reasonFor(next: string): string | undefined {
  if (next.endsWith("/book"))    return "Sign in to finish booking. Your dates are still available.";
  if (next.endsWith("/viewing")) return "Sign in to request a viewing.";
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);

  // Already signed in — honour the original destination instead of showing a
  // login form to someone who does not need one.
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(next);

  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-[#f6f3f2] px-4 py-14">
        <div className="max-w-sm mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-[#0d2137]">Welcome to VeriHome</h1>
            <p className="text-sm text-[#6e7a74] mt-1">
              Sign in to book a stay, request a viewing, and track both in one place.
            </p>
          </div>

          {/* Flip GOOGLE_AUTH_ENABLED to "true" once the provider is configured
              in Supabase — enabling it is then a config change, not a deploy. */}
          <LoginForm
            next={next}
            reason={reasonFor(next)}
            googleEnabled={process.env.GOOGLE_AUTH_ENABLED === "true"}
          />

          <p className="text-xs text-[#6e7a74] text-center mt-6">
            Listing a property instead?{" "}
            <Link href="/list-your-property" className="text-[#1a7a5e] font-semibold hover:underline">
              Submit it here
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
