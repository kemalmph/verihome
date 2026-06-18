import Link from "next/link";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { PLACEHOLDER_PROPERTIES } from "@/lib/placeholder-data";
import { getCurrentUser } from "@/lib/supabase/get-current-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const savedCount = 2;
  const appointmentsCount = 1;
  const activeServicesCount = 1;
  const savedPreviews = PLACEHOLDER_PROPERTIES.slice(0, 2);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar
        activeHref="/dashboard"
        userName={user.name}
        isActiveClient={user.is_active_client}
      />

      <main className="flex-1 ml-72 p-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-[#0d2137] mb-1">
            Welcome back, {firstName}
          </h2>
          <p className="text-[#3e4944] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1a7a5e] text-base">info</span>
            You have 1 upcoming consultation and 2 unread messages.
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { icon: "favorite", label: "Saved Listings", value: savedCount, color: "text-[#0d2137]" },
            { icon: "calendar_month", label: "Appointments", value: appointmentsCount, color: "text-[#1a7a5e]" },
            { icon: "assignment", label: "Active Services", value: activeServicesCount, color: "text-[#4a5753]" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-[#cccccc] p-6 rounded-lg shadow-sm flex items-center gap-4"
            >
              <div className="bg-[#f0eded] p-3 rounded-full">
                <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-semibold text-[#0d2137]">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left */}
          <div className="lg:col-span-7 space-y-6">
            {/* Upcoming Appointment */}
            <section className="bg-white border-2 border-[#1a7a5e]/20 rounded-lg p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#1a7a5e]">videocam</span>
                <h3 className="text-xl font-semibold text-[#0d2137]">
                  Consultation — Tomorrow, 2:00 PM
                </h3>
              </div>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#6e7a74]">apartment</span>
                  <div>
                    <p className="text-xs text-[#3e4944]">Property Focus</p>
                    <p className="font-semibold text-[#0d2137]">Modern 2BR Apartment, Senayan</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: "person_outline", label: "Advisor", value: "Budi Santoso" },
                    { icon: "inventory_2", label: "Package", value: "Premium (60 min)" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#6e7a74]">{item.icon}</span>
                      <div>
                        <p className="text-xs text-[#3e4944]">{item.label}</p>
                        <p className="font-semibold text-[#0d2137] text-sm">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-4 border-t border-[#bec9c2]/30">
                <button className="bg-[#1a7a5e] text-white px-6 py-3 rounded-md font-medium flex items-center gap-2 hover:opacity-90">
                  <span className="material-symbols-outlined text-lg">video_call</span>
                  Join Google Meet
                </button>
                <button className="border border-[#6e7a74] text-[#0d2137] px-6 py-3 rounded-md font-medium hover:bg-[#f6f3f2]">
                  Reschedule
                </button>
              </div>
            </section>

            {/* Active Services */}
            <section className="bg-white border border-[#cccccc] rounded-lg p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[#0d2137] mb-6">Active Client Services</h3>
              <div className="flex items-center justify-between p-4 bg-[#f6f3f2] rounded-lg mb-4">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-md shadow-sm">
                    <span className="material-symbols-outlined text-[#1a7a5e]">translate</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#0d2137]">English Lease Translation</p>
                    <p className="text-xs text-[#3e4944]">Draft review for Senayan Apartment</p>
                  </div>
                </div>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
                  In Progress
                </span>
              </div>
            </section>
          </div>

          {/* Right */}
          <div className="lg:col-span-5 space-y-6">
            {/* Saved Listings */}
            <section className="bg-white border border-[#cccccc] rounded-lg shadow-sm">
              <div className="p-6 border-b border-[#bec9c2]">
                <h3 className="text-xl font-semibold text-[#0d2137]">Saved Listings</h3>
              </div>
              <div className="p-6 space-y-5">
                {savedPreviews.map((p) => {
                  const price = new Intl.NumberFormat("id-ID").format(p.price_per_month);
                  return (
                    <div key={p.id} className="flex gap-4 group cursor-pointer">
                      <div className="w-24 h-20 rounded-md bg-[#e4e2e1] flex-shrink-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#6e7a74] text-xl">apartment</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#0d2137] truncate text-sm">{p.title}</p>
                        <p className="text-xs text-[#3e4944] mb-2">{p.area}, {p.district}</p>
                        <div className="flex justify-between items-end">
                          <p className="text-sm font-bold text-[#1a7a5e]">IDR {price}<span className="text-xs font-normal text-[#6e7a74]">/mo</span></p>
                          <span className="material-symbols-outlined text-lg text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 bg-[#f6f3f2] text-center rounded-b-lg">
                <Link href="/dashboard/saved" className="text-[#1a7a5e] text-sm font-bold hover:underline">
                  View All Saved Listings
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
