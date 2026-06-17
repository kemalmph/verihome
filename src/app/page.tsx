import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListingCard } from "@/components/listings/ListingCard";
import { getFeaturedProperties } from "@/lib/supabase/queries";
import { getSavedPropertyIds } from "@/lib/supabase/save-actions";

export default async function HomePage() {
  const [featuredListings, savedIds] = await Promise.all([
    getFeaturedProperties(3),
    getSavedPropertyIds(),
  ]);

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative min-h-[600px] md:min-h-[720px] flex items-center overflow-hidden bg-[#0d2137]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d2137]/90 via-[#0d2137]/60 to-transparent z-10" />
          <div className="relative z-20 w-full max-w-7xl mx-auto px-4 md:px-16 py-20">
            <div className="max-w-2xl text-white">
              <span className="inline-flex items-center px-3 py-1 bg-[#cee1ff] text-[#081c32] rounded-full text-xs font-semibold mb-6">
                <span className="material-symbols-outlined text-[14px] mr-1">
                  verified
                </span>
                Independently Verified for Expats
              </span>
              <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
                Find your curated home in Jakarta.
              </h1>
              <p className="text-xl text-[#80d7b6] font-semibold mb-4">
                Curated homes. Confident decisions.
              </p>
              <p className="text-lg text-white/80 mb-10 max-w-lg leading-relaxed">
                VeriHome verifies every listing so you can rent with confidence
                — wherever you&apos;re coming from. We bridge the gap with
                professional, independent expertise.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/listings"
                  className="px-8 py-4 bg-[#1a7a5e] text-white rounded-lg font-semibold shadow-lg hover:opacity-90 transition-all text-center"
                >
                  Browse Listings
                </Link>
                <Link
                  href="/consultation"
                  className="px-8 py-4 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-[#0d2137] transition-all text-center"
                >
                  Book a Consultation
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="bg-[#f6f3f2] py-6 border-b border-[#bec9c2]">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-50">
              {[
                "SCBD JAKARTA",
                "KEMANG HUB",
                "SUDIRMAN CENTER",
                "KUNINGAN PLACE",
                "MEGA KUNINGAN",
              ].map((name) => (
                <span
                  key={name}
                  className="font-bold text-[#3e4944] tracking-widest text-sm"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Listings */}
        <section className="py-20 max-w-7xl mx-auto px-4 md:px-16">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-bold text-[#0d2137]">
                Featured Listings
              </h2>
              <p className="text-[#3e4944] mt-1">
                Our top picks for this month&apos;s relocations.
              </p>
            </div>
            <Link
              href="/listings"
              className="hidden sm:flex items-center gap-1 text-[#1a7a5e] font-bold hover:underline text-sm"
            >
              View All Listings
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredListings.map((property) => (
              <ListingCard key={property.id} property={property} savedIds={savedIds} />
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="bg-[#0d2137] text-white py-20">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-3">
                Relocate with Confidence
              </h2>
              <p className="text-white/70 text-lg max-w-xl mx-auto">
                We&apos;ve streamlined the Jakarta housing search to meet global
                standards.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                {
                  icon: "search_check",
                  title: "Curated Search",
                  desc: "Browse our hand-picked selection of properties that pass our 50-point quality checklist.",
                },
                {
                  icon: "verified_user",
                  title: "Verified Viewing",
                  desc: "Schedule high-res video tours or in-person viewings accompanied by our relocation experts.",
                },
                {
                  icon: "key",
                  title: "Seamless Move-in",
                  desc: "From lease negotiation to utility setup, we handle the local paperwork so you don't have to.",
                },
              ].map((step) => (
                <div key={step.title} className="text-center">
                  <div className="w-16 h-16 bg-[#1a7a5e] text-white rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-2xl">
                      {step.icon}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-white/70 leading-relaxed px-4">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Neighborhoods */}
        <section
          id="neighborhoods"
          className="py-20 max-w-7xl mx-auto px-4 md:px-16"
        >
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-[#0d2137]">
              Explore Neighborhoods
            </h2>
            <p className="text-[#3e4944] mt-1">
              Find the Jakarta that fits your lifestyle.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Kemang",
                desc: "The leafy heart of Jakarta's expat community. Full of villas and trendy cafes.",
              },
              {
                name: "SCBD",
                desc: "Modern luxury living just steps away from the city's financial headquarters.",
              },
              {
                name: "Menteng",
                desc: "Quiet, prestigious, and full of history. Jakarta's most elite diplomatic district.",
              },
            ].map((hood) => (
              <div
                key={hood.name}
                className="relative h-72 rounded-xl overflow-hidden group cursor-pointer bg-[#0d2137]"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full p-6">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {hood.name}
                  </h3>
                  <p className="text-white/80 text-sm mb-4">{hood.desc}</p>
                  <Link
                    href={`/listings?area=${hood.name.toLowerCase()}`}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                  >
                    Explore {hood.name}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 bg-[#f0eded]">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            <div className="flex flex-col md:flex-row gap-12 items-center">
              <div className="md:w-1/3">
                <h2 className="text-3xl font-bold text-[#0d2137] mb-4">
                  Trusted by hundreds of professionals.
                </h2>
                <div className="flex gap-1 text-[#1a7a5e]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  ))}
                </div>
              </div>
              <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    quote:
                      "Relocating from London to Jakarta was daunting, but VeriHome made the housing search effortless. The video tours were exactly like the actual apartment.",
                    name: "Sarah C.",
                    role: "Tech Lead @ Grab",
                  },
                  {
                    quote:
                      "I needed a place in SCBD quickly. Within 48 hours, VeriHome found me a verified studio and handled all the local leasing contracts. Truly premium service.",
                    name: "Mark K.",
                    role: "Diplomat @ EU Embassy",
                  },
                ].map((t) => (
                  <div
                    key={t.name}
                    className="bg-white p-6 rounded-xl border border-[#cccccc] shadow-sm"
                  >
                    <p className="text-[#3e4944] italic mb-6 leading-relaxed">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#9cf4d1] flex items-center justify-center font-bold text-[#002116] text-sm">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <span className="block font-bold text-[#1b1c1c] text-sm">
                          {t.name}
                        </span>
                        <span className="block text-xs text-[#3e4944]">
                          {t.role}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-[#0d2137] py-14 px-4 md:px-16">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
            {[
              { value: "200+", label: "Verified Listings" },
              { value: "100%", label: "Independent Advisors" },
              { value: "4.9/5", label: "Consultation Rating" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-5xl font-bold text-[#80d7b6] mb-2">
                  {stat.value}
                </p>
                <p className="text-[#e4e2e1] text-xs font-bold uppercase tracking-widest">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
