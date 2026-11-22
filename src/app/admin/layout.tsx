import { requireAdminPageOrRedirect } from "@/lib/auth/gate";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageOrRedirect();
  return <>{children}</>;
}
