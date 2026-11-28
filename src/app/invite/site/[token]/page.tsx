import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AcceptSiteInvite } from "./AcceptSiteInvite";

export const dynamic = "force-dynamic";

/**
 * Accepting a site staff invite. Outside /site on purpose: the person is not
 * staff of anything yet, so the /site gate would turn them away.
 *
 * Nothing here reads the invite — whether it is valid, for whom, and for which
 * site is only decided when they press the button (redeem_site_staff_invite),
 * so the page does not confirm anything to someone holding a guessed token.
 */
export default async function SiteInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/invite/site/${token}`)}`);

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-ink">Undangan staf site</h1>
        <p className="text-sm text-ink-2 mt-2">
          Anda masuk sebagai <strong>{user.email}</strong>. Undangan hanya bisa dipakai
          oleh email yang diundang, dan hanya sekali.
        </p>
        <div className="mt-8">
          <AcceptSiteInvite token={token} />
        </div>
      </main>
      <Footer />
    </>
  );
}
