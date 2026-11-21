import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { getSite, listOwnerOptions } from "@/lib/actions/coworking-actions";
import { SiteDetailForm } from "./SiteDetailForm";
import { UnitManager } from "./UnitManager";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CoworkingSitePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [result, owners] = await Promise.all([getSite(id), listOwnerOptions()]);
  if (!result) notFound();

  const { site, units } = result;

  const lettable = units.filter((u) => u.status === "available");
  const seats = lettable.reduce((n, u) => n + Number(u.capacity ?? 0), 0);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/coworking" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <nav className="text-sm text-[#6e7a74] mb-4">
          <Link href="/admin/coworking" className="hover:underline">Coworking</Link>
          <span className="mx-2">/</span>
          <span className="text-[#3e4944]">{site.name}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">{site.name}</h1>
          <p className="text-[#3e4944] mt-1">
            {units.length} unit · {lettable.length} tersedia · kapasitas {seats}
          </p>
        </header>

        <SiteDetailForm site={site} owners={owners} />

        <UnitManager siteId={site.id} units={units} />
      </main>
    </div>
  );
}
