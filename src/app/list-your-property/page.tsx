import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListYourPropertyForm } from "./ListYourPropertyForm";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

export default async function ListYourPropertyPage() {
  const lang = await getLocale();

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 md:px-16 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-ink mb-3">
            {t("listProp.title", lang)}
          </h1>
          <p className="text-lg text-ink-2 leading-relaxed">
            {t("listProp.sub", lang)}
          </p>
        </div>
        <ListYourPropertyForm />
      </main>
      <Footer />
    </>
  );
}
