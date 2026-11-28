import { AccountSidebar } from "@/components/layout/AccountSidebar";
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
    <div className="flex min-h-screen bg-canvas">
      <AccountSidebar activeHref="/account/appointments" userName={user.name} isActiveClient={user.is_active_client} />

      <main className="flex-1 ml-0 md:ml-(--dash-sidebar-w) md:transition-[margin] p-6 md:p-16 pt-20 md:pt-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-ink mb-1">Appointments</h2>
          <p className="text-ink-2">{PLACEHOLDER_APPOINTMENTS.length} upcoming appointment</p>
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
              completed: "bg-canvas text-ink-2",
            };

            return (
              <div key={apt.id} className="bg-white rounded-2xl border border-line shadow-card p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-soft rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-brand-ink">
                        {apt.appointment_type === "consultation" ? "videocam" : "location_on"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-ink capitalize">{apt.appointment_type}</h3>
                      <p className="text-sm text-ink-2">{dateStr} at {timeStr}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${statusColors[apt.status]}`}>
                    {apt.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {apt.advisor_name && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-ink-3">person</span>
                      <div>
                        <p className="text-xs text-ink-2">Advisor</p>
                        <p className="font-semibold text-ink">{apt.advisor_name}</p>
                      </div>
                    </div>
                  )}
                  {apt.notes && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-ink-3">notes</span>
                      <div>
                        <p className="text-xs text-ink-2">Notes</p>
                        <p className="text-sm text-ink">{apt.notes}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-line-strong/30">
                  <button className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
                    <span className="material-symbols-outlined text-lg">video_call</span>
                    Join Meeting
                  </button>
                  <button className="border border-ink-3 text-ink px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-canvas">
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
              <span className="material-symbols-outlined text-5xl text-line-strong block mb-4">calendar_today</span>
              <h3 className="text-xl font-semibold text-ink mb-2">No appointments yet</h3>
              <p className="text-ink-2">Book a consultation to get started.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
