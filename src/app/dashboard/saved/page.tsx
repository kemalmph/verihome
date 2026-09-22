import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { guestSavedUnits } from "@/lib/guest/unit";
import { t } from "@/lib/i18n/strings";
import { SavedList } from "./SavedList";

export const dynamic = "force-dynamic";

export default async function SavedListingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/dashboard/saved");

  // This page used to render PLACEHOLDER_PROPERTIES — three fixed demo units,
  // identical for every account, regardless of what anyone had actually saved.
  const saved = await guestSavedUnits();

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <DashboardSidebar activeHref="/dashboard/saved" userName={user.name} isActiveClient={user.is_active_client} />
      <main className="flex-1 ml-0 md:ml-72 p-6 md:p-12 pt-20 md:pt-12 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137] mb-1">{t("saved.title")}</h1>
          <p className="text-[#3e4944]">{saved.length} unit tersimpan</p>
        </header>
        <SavedList items={saved} />
      </main>
    </div>
  );
}
