import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  // Surveyors sign in through the same page and land here. Sending them back to
  // the login form would loop, since they are already signed in — route them to
  // the one area they do have access to.
  if (viewer?.role === "surveyor") redirect("/survey");
  if (viewer?.role !== "admin")    redirect("/admin-login");

  return <>{children}</>;
}
