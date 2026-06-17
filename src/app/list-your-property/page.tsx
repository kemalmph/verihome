import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListYourPropertyForm } from "./ListYourPropertyForm";

export default function ListYourPropertyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 md:px-16 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-[#0d2137] mb-3">
            List your property
          </h1>
          <p className="text-lg text-[#3e4944] leading-relaxed">
            Join our curated marketplace. We verify every listing to ensure the
            highest quality for tenants — and best outcomes for owners.
          </p>
        </div>
        <ListYourPropertyForm />
      </main>
      <Footer />
    </>
  );
}
