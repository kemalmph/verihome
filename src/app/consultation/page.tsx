import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function ConsultationPage() {
  const packages = [
    {
      id: "basic",
      label: "BASIC",
      price: "IDR 99,000",
      features: [
        "30min consultation session",
        "Live virtual walkthrough",
        "Direct Q&A session",
        "Basic area insights",
      ],
      popular: false,
    },
    {
      id: "premium",
      label: "PREMIUM",
      price: "IDR 199,000",
      features: [
        "60min comprehensive session",
        "Live virtual walkthrough",
        "Suitability assessment report",
        "In-depth neighborhood insights",
        "Alternative property suggestions",
      ],
      popular: true,
    },
  ];

  return (
    <>
      <Navbar />
      <main className="max-w-[1280px] mx-auto px-4 md:px-16 py-20">
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6 text-[#3e4944]">
          <span className="text-sm font-bold text-[#1a7a5e]">Step 1 of 3</span>
          <span className="text-sm">•</span>
          <span className="text-sm">Consultation Selection</span>
        </div>

        <div className="mb-16 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0d2137] mb-3">
            Choose your consultation package
          </h1>
          <p className="text-lg text-[#3e4944] max-w-2xl">
            Both packages include a live virtual walkthrough with an independent
            VeriHome advisor. Get expert guidance from the comfort of your home.
          </p>
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 items-stretch max-w-3xl">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-xl p-8 flex flex-col transition-all shadow-sm ${
                pkg.popular
                  ? "border-2 border-[#1a7a5e] relative md:scale-105"
                  : "border border-[#cccccc]"
              }`}
            >
              {pkg.popular && (
                <div className="absolute top-0 right-0 bg-[#1a7a5e] text-white px-4 py-1 text-xs font-bold rounded-bl-xl rounded-tr-xl">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <span className="text-xs font-bold text-[#3e4944] uppercase tracking-widest">
                  {pkg.label}
                </span>
                <h2 className="text-3xl font-bold text-[#0d2137] mt-1">
                  {pkg.price}
                </h2>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {pkg.features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span
                      className="material-symbols-outlined text-[#1a7a5e]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className={pkg.popular ? "font-medium" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/consultation/book?package=${pkg.id}`}
                className={`w-full text-center py-4 rounded-xl font-semibold transition-all ${
                  pkg.popular
                    ? "bg-[#1a7a5e] text-white hover:opacity-90 shadow-md"
                    : "border border-[#1a7a5e] text-[#1a7a5e] hover:bg-[#e8f5f0]"
                }`}
              >
                Choose {pkg.label.charAt(0) + pkg.label.slice(1).toLowerCase()}
              </Link>
            </div>
          ))}
        </div>

        {/* Selected property preview */}
        <div className="border-t border-[#bec9c2] pt-10">
          <p className="text-xs font-bold text-[#3e4944] uppercase tracking-widest mb-4">
            Select a property to consult about:
          </p>
          <div className="flex items-center gap-4 bg-[#f6f3f2] p-4 rounded-xl max-w-lg border border-[#cccccc]">
            <div className="w-28 h-20 rounded-lg bg-[#e4e2e1] flex-shrink-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#6e7a74] text-2xl">image</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#1b1c1c]">
                Select from your saved listings
              </h3>
              <Link
                href="/listings"
                className="text-sm text-[#1a7a5e] font-medium hover:underline"
              >
                Browse listings →
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
