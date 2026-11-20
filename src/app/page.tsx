import Image from "next/image";
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
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcksN-p-DaXBjiUxEHR1FaW24hMXJk8TVSU21Z4YMT4Wey8sS9xPDMnnqS8kj8r5PAu55TVtFKgwKiK841DDSBhLcNlKj2UjKEpMCC8w60A16LKW_d2lVdeeBZ5qtZEiY92LByl39oiD_eB5kJ18I9dpbYV1nBQ8YPYdB7HNmlmVqilg5ly-G6LOyfRGWudOapiAzr-BdowVi0e3dYz0XewyMhNXNUysxD8rUAAC0uQJAlOE-hz_3ChCjD-wNEWzDfdBL5vxc9zIkW"
            alt="Luxury Jakarta apartment interior"
            fill
            className="object-cover object-center"
            priority
          />
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
        <section id="how-it-works" className="bg-white py-24">
          <div className="max-w-7xl mx-auto px-4 md:px-16 flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <h2 className="text-3xl font-bold text-[#0d2137] mb-12">The VeriHome Process</h2>
              <div className="space-y-10">
                {[
                  { n: "1", title: "Browse Curated Listings", desc: "Access a hand-picked selection of properties that meet international quality standards and are actually available." },
                  { n: "2", title: "Independent Consultation", desc: "Talk to an advisor who works for you, not the landlord. Get honest feedback on neighborhoods, pricing, and amenities." },
                  { n: "3", title: "Move In with Confidence", desc: "Enjoy a seamless transaction and the peace of mind that your new home is exactly what was promised." },
                ].map((step) => (
                  <div key={step.n} className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#1a7a5e] text-white flex items-center justify-center font-bold text-xl">{step.n}</div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#1b1c1c] mb-1">{step.title}</h3>
                      <p className="text-[#3e4944] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:w-1/2 flex justify-center">
              <div className="w-full max-w-md aspect-square bg-[#f0eded] rounded-full flex items-center justify-center relative overflow-hidden">
                <div className="relative w-4/5 h-4/5 rounded-3xl overflow-hidden shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                  <Image
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDD6x7Y5th2JvBJ0vQETwVH9pa-oQhNT-64n7d2c-8vePEun1SvOzTxPApz0IMaNIaI8_k_x4-jXeY0WdXWEuG6tOb1vqQbEn3UnEw-KYQMMnpiT30cA5glZ8-4kgcdpDZQbWtiLm5HBDFCJ9Q8ZaZ8ggFy2SKoYkmeqyjJUKGBiHdHTRySl25fRpv6EJE5edbZBhqDn7IjCBb0iptp9l4BDi-zj5lsc9uNqszytOu_x5GTzle1arMsxeyBmFV-_A50o0_kdG6_1FB3"
                    alt="VeriHome consultation process"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
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
                img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnu9lA3Tbbjwi9fmwwMCinoaLpY557NcN-8V5cFhxNeInVc2h_y1TW9w1lQAeTsP9u4sCRs3N019NYREc-BiYh3I1w3gLyyKrJPoxNDwQhri2Wmk1s_HEjnVkiEk4vaUVUFbud3kpiHEbUd-ulg6n5grHtLsfsHnILAp3aSfbZzdNbnBB1ztybuP82_mi9lgLb50nZBsA7oVWfXagEyDXVgrxKdkxkfehoctJtrUR-kOY6Wwz-80M_wciAU0_hapEnE6P_QlRCURg4",
              },
              {
                name: "SCBD",
                desc: "Modern luxury living just steps away from the city's financial headquarters.",
                img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDie1Xp1Fuzrbd2YKZwW0geG0EzgtJsPTtowEcKIZ1N-I8NmcM90U523OeufOqwSyYM-n53j8eprYP6Iu4tD-cxGgwg1ncMzLXcNrmBGCWRSGk2pMmcRR3kwnsbon86hm2Xf60B_qktfbYSvCOWvCwNHFBZCXIkYgu-TGGRLT9TieP9iG_BlwEf2SKCicQJRkp6VGQF0dyAPRBCirVjH7u9bGaMGbFDc6juO1Pno3WAyzNeJjbytnOcDFMMaXmzpgImvxhrwPSZ-QZl",
              },
              {
                name: "Menteng",
                desc: "Quiet, prestigious, and full of history. Jakarta's most elite diplomatic district.",
                img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCK-ErtDsxD1mVxFZLMDpSb2FdDHG7fa2T5wCIPbO9iT_cUzhJHJRwxrLFwzvIvrrrTGdpeEbau4jQ3Z9ERj-lm2LDFoKgVAcY39W_DORxDwRdpB9N3eBH6-Gl2YExzmPSaQkhzvLGCeLqbtG508Gad4m3aEBr9Is0PyyEjdjB_ktgmToUVqr9L5o1Ula5UAdfutrELptodCcBIvvJDJBtHtZadFV7g0tLKcjppF9twYsn7c6gUVSpF0qNhL7xkbzgeHZFsiTriYyXV",
              },
            ].map((hood) => (
              <div
                key={hood.name}
                className="relative h-72 rounded-xl overflow-hidden group cursor-pointer bg-[#0d2137]"
              >
                <Image src={hood.img} alt={hood.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
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
