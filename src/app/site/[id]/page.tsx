import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { getSite, listOwnerOptions } from "@/lib/actions/coworking-actions";
import { SiteDetailForm } from "./SiteDetailForm";
import { UnitManager } from "./UnitManager";
import { AmenityManager } from "./AmenityManager";
import { getAmenityAssignments } from "@/lib/actions/amenity-actions";
import { resolveSiteId } from "@/lib/coworking/resolve";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CoworkingSitePage({ params }: Props) {
  const viewer = await requirePermissionOrRedirect(["sites.operate_all", "sites.finance_all"]);
  // Amenity assignments are an operate_all read (and write). A finance-only
  // viewer used to reach this page and get a 500 from that guard; they now get
  // the page without the amenity editor.
  const canOperate = viewer.permissions.includes("sites.operate_all");
  const { id: param } = await params;
  const id = await resolveSiteId(param);
  if (!id) notFound();


  const [result, owners, amenities] = await Promise.all([
    getSite(id), listOwnerOptions(), canOperate ? getAmenityAssignments(id) : Promise.resolve(null),
  ]);
  if (!result) notFound();

  const { site, units } = result;

  const lettable = units.filter((u) => u.status === "available");
  const seats = lettable.reduce((n, u) => n + Number(u.capacity ?? 0), 0);

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AppSidebar activeHref={`/site/${param}`} />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <nav className="text-sm text-[#6e7a74] mb-4">
          <Link href="/site" className="hover:underline">Site</Link>
          <span className="mx-2">/</span>
          <span className="text-[#3e4944]">{site.name}</span>
        </nav>

        <header className="mb-8 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2137]">{site.name}</h1>
            <p className="text-[#3e4944] mt-1">
              {units.length} unit · {lettable.length} tersedia · kapasitas {seats}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/site/${site.slug}/members`}
              className="px-4 py-2 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-white"
            >
              Member
            </Link>
            <Link
              href={`/site/${site.slug}/calendar`}
              className="px-4 py-2 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-white"
            >
              Kalender
            </Link>
            <Link
              href={`/site/${site.slug}/dashboard`}
              className="px-4 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:bg-[#166750]"
            >
              Dashboard operator
            </Link>
          </div>
        </header>

        <SiteDetailForm site={site} owners={owners} />

        <UnitManager siteId={site.id} units={units} />

        {amenities && <AmenityManager siteId={site.id} units={units} assignments={amenities} />}
      </main>
    </div>
  );
}
