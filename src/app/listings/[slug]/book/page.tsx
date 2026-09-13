import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getPropertyBySlug } from "@/lib/supabase/queries";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { BookingFlow } from "./BookingFlow";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;

  const [property, user] = await Promise.all([
    getPropertyBySlug(slug),
    getCurrentUser().catch(() => null),
  ]);

  if (!property) notFound();

  if (!user) redirect(`/auth/login?next=/listings/${slug}/book`);

  const rate = property.short_stay_rates;
  if (!rate || !rate.active) {
    // Not available for short stay — redirect back
    redirect(`/listings/${slug}`);
  }

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="text-sm text-[#6e7a74] mb-1">{property.area}</div>
          <h1 className="text-2xl font-bold text-[#0d2137]">{property.name}</h1>
        </div>
        <BookingFlow
          propertyId={property.id}
          rate={rate}
        />
      </main>
      <Footer />
    </>
  );
}
