import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import type { Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLACEHOLDER_APPOINTMENTS: Appointment[] = [
  {
    id: "a1",
    user_id: "u1",
    property_id: "1",
    appointment_type: "consultation",
    status: "confirmed",
    scheduled_at: "2025-07-02T14:00:00",
    advisor_name: "Budi Santoso",
    notes: "Premium consultation package — 60 min session",
  },
];

export default async function AppointmentsPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/appointments" userName={user.name} isActiveClient={user.is_active_client} />

      <main className="flex-1 ml-72 p-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-[#0d2137] mb-1">Appointments</h2>
          <p className="text-[#3e4944]">{PLACEHOLDER_APPOINTMENTS.length} upcoming appointment</p>
        </header>

        <div className="space-y-6">
          {PLACEHOLDER_APPOINTMENTS.map((apt) => {
            const date = new Date(apt.scheduled_at);
            const dateStr = date.toLocaleDateString("en-US", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
            const timeStr = date.toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit",
            });

            const statusColors: Record<string, string> = {
              confirmed: "bg-green-100 text-green-800",
              pending: "bg-yellow-100 text-yellow-800",
              cancelled: "bg-red-100 text-red-800",
              completed: "bg-[#f6f3f2] text-[#3e4944]",
            };

            return (
              <div key={apt.id} className="bg-white rounded-xl border border-[#cccccc] p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#e8f5f0] rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#1a7a5e]">
                        {apt.appointment_type === "consultation" ? "videocam" : "location_on"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-[#0d2137] capitalize">{apt.appointment_type}</h3>
                      <p className="text-sm text-[#3e4944]">{dateStr} at {timeStr}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${statusColors[apt.status]}`}>
                    {apt.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {apt.advisor_name && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#6e7a74]">person</span>
                      <div>
                        <p className="text-xs text-[#3e4944]">Advisor</p>
                        <p className="font-semibold text-[#0d2137]">{apt.advisor_name}</p>
                      </div>
                    </div>
                  )}
                  {apt.notes && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[#6e7a74]">notes</span>
                      <div>
                        <p className="text-xs text-[#3e4944]">Notes</p>
                        <p className="text-sm text-[#1b1c1c]">{apt.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-[#bec9c2]/30">
                  <button className="bg-[#1a7a5e] text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
                    <span className="material-symbols-outlined text-lg">video_call</span>
                    Join Meeting
                  </button>
                  <button className="border border-[#6e7a74] text-[#0d2137] px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#f6f3f2]">
                    Reschedule
                  </button>
                  <button className="text-red-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50">
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}

          {PLACEHOLDER_APPOINTMENTS.length === 0 && (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-5xl text-[#bec9c2] block mb-4">calendar_today</span>
              <h3 className="text-xl font-semibold text-[#1b1c1c] mb-2">No appointments yet</h3>
              <p className="text-[#3e4944]">Book a consultation to get started.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
