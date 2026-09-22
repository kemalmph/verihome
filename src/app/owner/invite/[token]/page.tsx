import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { t } from "@/lib/i18n/strings";
import { AcceptInvite } from "./AcceptInvite";

export const dynamic = "force-dynamic";

/**
 * The one page in /owner that an unlinked user may reach — it is how they
 * become linked. It sits outside the portal layout's audience for that reason.
 */
export default async function OwnerInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Sign in first, then come straight back to this token.
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/owner/invite/${token}`)}`);
  }

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-[#0d2137]">{t("owner.invite.title")}</h1>
        <p className="text-sm text-[#3e4944] mt-2">{t("owner.invite.intro")}</p>
        <p className="text-xs text-[#6e7a74] mt-1">{t("owner.invite.intro", "en")}</p>

        <div className="mt-8">
          <AcceptInvite token={token} />
        </div>
      </main>
      <Footer />
    </>
  );
}
