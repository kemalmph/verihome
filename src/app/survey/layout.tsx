import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/guards";

// Open to surveyors and admins. Admins reach the same form from Build Listing.
export default async function SurveyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/admin-login?next=/survey");
  return <>{children}</>;
}
