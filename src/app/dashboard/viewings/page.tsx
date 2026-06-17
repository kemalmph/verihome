import Link from "next/link";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

export default function ViewingsPage() {
  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/viewings" userName="Sarah C." isActiveClient={true} />

      <main className="flex-1 ml-72 p-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-[#0d2137] mb-1">Viewings</h2>
          <p className="text-[#3e4944]">Track your scheduled property viewings.</p>
        </header>

        <div className="text-center py-20">
          <div className="w-20 h-20 bg-[#e8f5f0] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-[#1a7a5e] text-4xl">location_on</span>
          </div>
          <h3 className="text-xl font-semibold text-[#1b1c1c] mb-2">No viewings scheduled</h3>
          <p className="text-[#3e4944] mb-6">
            Request a viewing from any listing page to schedule a physical visit.
          </p>
          <Link
            href="/listings"
            className="inline-block bg-[#1a7a5e] text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Browse Listings
          </Link>
        </div>
      </main>
    </div>
  );
}
