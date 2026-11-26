import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/guards";

// Any staff member may enter; each page requires surveys.input itself.
export default async function SurveyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/admin-login?next=/survey");
  return <>{children}</>;
}
