import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function ConsultationSuccessPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-[#e8f5f0] rounded-full flex items-center justify-center mx-auto mb-6">
          <span
            className="material-symbols-outlined text-[#1a7a5e] text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
        </div>

        <h1 className="text-3xl font-bold text-[#0d2137] mb-3">Booking confirmed!</h1>
        <p className="text-lg text-[#3e4944] mb-2">
          Payment received. Your consultation is booked.
        </p>
        <p className="text-[#6e7a74] mb-10">
          A VeriHome advisor will contact you within <strong>24 hours</strong> to schedule your session. Check your email for the confirmation.
        </p>

        <div className="bg-[#f6f3f2] rounded-xl border border-[#bec9c2] p-6 mb-8 text-left space-y-3">
          {[
            { icon: "calendar_today", text: "Advisor will reach out within 24 hours" },
            { icon: "videocam", text: "Session via Google Meet or Zoom" },
            { icon: "description", text: "Report emailed after session (Premium only)" },
          ].map((item) => (
            <div key={item.icon} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#1a7a5e]">{item.icon}</span>
              <span className="text-sm text-[#3e4944]">{item.text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/appointments"
            className="px-6 py-3 bg-[#1a7a5e] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            View Appointment
          </Link>
          <Link
            href="/listings"
            className="px-6 py-3 border border-[#0d2137] text-[#0d2137] rounded-lg font-semibold hover:bg-[#f6f3f2] transition-colors"
          >
            Browse More Listings
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
