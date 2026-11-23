import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getPropertyBySlug } from "@/lib/supabase/queries";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { ViewingFlow } from "./ViewingFlow";
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
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="text-sm text-[#6e7a74] mb-1">{property.area}</div>
          <h1 className="text-2xl font-bold text-[#0d2137]">{property.name}</h1>
          <p className="text-sm text-[#3e4944] mt-2">
            {t("view.introA", lang)}{" "}
            <strong>IDR {new Intl.NumberFormat("id-ID").format(DEPOSIT)}</strong>{" "}
            {t("view.introB", lang)}
          </p>
        </div>
        <ViewingFlow
          propertyId={property.id}
          depositAmount={DEPOSIT}
        />
      </main>
      <Footer />
    </>
  );
}
