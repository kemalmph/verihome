import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { t } from "@/lib/i18n/strings";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Deliberately says nothing about WHY. An owner whose access was revoked and a
 * signed-in guest who never had any see the same page: distinguishing them
 * would confirm that a particular account is attached to an owner record.
 */
export default async function OwnerNoAccessPage() {
  const lang = await getLocale();

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-[#f6f3f2] rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[#6e7a74] text-3xl">lock</span>
        </div>
        <h1 className="text-xl font-bold text-[#0d2137]">{t("owner.access.denied", lang)}</h1>
        <p className="text-sm text-[#3e4944] mt-6">
          {t("owner.access.noInvite", lang)}
        </p>
        <Link href="/" className="inline-block mt-8 px-6 py-3 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90">
          {t("owner.access.home", lang)}
        </Link>
      </main>
      <Footer />
    </>
  );
}
