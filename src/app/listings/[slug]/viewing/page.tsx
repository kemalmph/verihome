import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getPropertyBySlug } from "@/lib/supabase/queries";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { ViewingFlow } from "./ViewingFlow";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const DEPOSIT = Number(process.env.VIEWING_DEPOSIT_AMOUNT ?? 50000);

export default async function ViewingPage({ params }: Props) {
  const { slug } = await params;

  const [property, user] = await Promise.all([
    getPropertyBySlug(slug),
    getCurrentUser().catch(() => null),
  ]);
  const lang = await getLocale();

  if (!property) notFound();
  if (!user) redirect(`/auth/login?next=/listings/${slug}/viewing`);

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
        >
          {t("view.introA", lang)}{" "}
          <strong className="text-ink">IDR {new Intl.NumberFormat("id-ID").format(DEPOSIT)}</strong>{" "}
          {t("view.introB", lang)}
        </CheckoutHeader>
        <ViewingFlow
          propertyId={property.id}
          depositAmount={DEPOSIT}
        />
        </div>
      </main>
      <Footer />
    </>
  );
}
