import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getPropertyBySlug } from "@/lib/supabase/queries";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { BookingFlow } from "./BookingFlow";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;

  const [property, user, lang] = await Promise.all([
    getPropertyBySlug(slug),
    getCurrentUser().catch(() => null),
    getLocale(),
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
      <main className="flex-1 bg-cream-2">
        <div className="max-w-2xl mx-auto px-4 md:px-6 pt-8 pb-14 md:pt-10 md:pb-20">
        <CheckoutHeader
          slug={slug}
          name={property.name}
          area={property.area}
          photo={property.photo_urls?.[0]}
          backLabel={t("flow.backToListing", lang)}
        />
        <BookingFlow
          propertyId={property.id}
          rate={rate}
        />
        </div>
      </main>
      <Footer />
    </>
  );
}
