import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/lib/supabase/get-current-user";

export const dynamic = "force-dynamic";

const SERVICES = [
  {
    id: "s1",
    icon: "translate",
    title: "English Lease Translation",
    desc: "We translate your lease agreement into plain English so you understand every clause before signing.",
    price: "IDR 150,000",
    status: "In Progress",
    statusColor: "bg-yellow-100 text-yellow-800",
  },
  {
    id: "s2",
    icon: "account_balance",
    title: "Bank Account Setup Assistance",
    desc: "Guidance and accompaniment to open a local bank account as a foreigner.",
    price: "IDR 200,000",
    status: null,
    statusColor: "",
  },
  {
    id: "s3",
    icon: "phone_in_talk",
    title: "SIM Card & Internet Setup",
    desc: "We handle your local phone number registration and home internet setup.",
    price: "IDR 100,000",
    status: null,
    statusColor: "",
  },
  {
    id: "s4",
    icon: "local_shipping",
    title: "Moving & Logistics Support",
    desc: "Coordination with trusted local movers for your relocation within Jakarta.",
    price: "IDR 300,000+",
    status: null,
    statusColor: "",
  },
];

export default async function SupportPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen bg-canvas">
      <DashboardSidebar activeHref="/dashboard/support" userName={user.name} isActiveClient={user.is_active_client} />

      <main className="flex-1 ml-0 md:ml-(--dash-sidebar-w) md:transition-[margin] p-6 md:p-16 pt-20 md:pt-16 max-w-[1400px]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-ink mb-1">Support & Services</h2>
          <p className="text-ink-2">Additional relocation services to make your move seamless.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SERVICES.map((service) => (
            <div key={service.id} className="bg-white rounded-2xl border border-line shadow-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-soft rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-brand-ink">{service.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink">{service.title}</h3>
                    <p className="text-brand-ink font-bold text-sm">{service.price}</p>
                  </div>
                </div>
                {service.status && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${service.statusColor}`}>
                    {service.status}
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-2 mb-6 leading-relaxed">{service.desc}</p>
              <button className="w-full py-2.5 border-2 border-brand text-brand-ink rounded-lg text-sm font-medium hover:bg-brand hover:text-white transition-colors">
                {service.status ? "View Details" : "Request Service"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-ink rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-white mb-1">Need something else?</h3>
            <p className="text-sm text-white/70">Our team is available 9 AM – 6 PM WIB, Monday to Saturday.</p>
          </div>
          <a
            href="https://wa.me/6281234567890"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <span className="material-symbols-outlined">chat</span>
            Chat on WhatsApp
          </a>
        </div>
      </main>
    </div>
  );
}
