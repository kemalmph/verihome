import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "./BookingForm";

interface BookPageProps {
  searchParams: Promise<{ package?: string }>;
}

export default async function BookConsultationPage({ searchParams }: BookPageProps) {
  const { package: pkg } = await searchParams;
  const packageId = pkg === "premium" ? "premium" : "basic";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/?login=1");

  // Fetch user's saved properties for the dropdown
  const { data: saved } = await supabase
    .from("saved_listings")
    .select("property_id, properties(id, name, area)")
    .eq("user_id", user.id)
    .limit(20);

  const savedProperties = (saved ?? [])
    .flatMap((s) => {
      const p = s.properties as unknown as { id: string; name: string; area: string } | null;
      return p ? [{ id: p.id, name: p.name, area: p.area }] : [];
    });

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 md:px-8 py-16">
        {/* Breadcrumb stepper */}
        <div className="flex items-center gap-2 mb-8 text-sm text-[#3e4944]">
          <Link href="/consultation" className="text-[#1a7a5e] font-semibold hover:underline">
            Step 1: Choose Package
          </Link>
          <span className="material-symbols-outlined text-sm text-[#bec9c2]">chevron_right</span>
          <span className="font-bold text-[#1b1c1c]">Step 2: Confirm & Pay</span>
          <span className="material-symbols-outlined text-sm text-[#bec9c2]">chevron_right</span>
          <span className="text-[#bec9c2]">Step 3: Confirmation</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137] mb-2">Confirm your booking</h1>
          <p className="text-[#3e4944]">
            You&apos;ll be redirected to Xendit to complete payment securely.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm p-8">
          <BookingForm defaultPackage={packageId} savedProperties={savedProperties} />
        </div>
      </main>
      <Footer />
    </>
  );
}
