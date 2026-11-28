import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSitePage } from "@/lib/auth/site-access";
import { hasSitePermission } from "@/lib/auth/site-permissions";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { getSite, listOwnerOptions } from "@/lib/actions/coworking-actions";
import { SiteDetailForm } from "./SiteDetailForm";
import { UnitManager } from "./UnitManager";
import { AmenityManager } from "./AmenityManager";
import { getAmenityAssignments } from "@/lib/actions/amenity-actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CoworkingSitePage({ params }: Props) {
  const { id: param } = await params;
  // Not-found for "no such site" and "not yours" alike.
  const access = await requireSitePage(param, "site.view");
  const id = access.siteId;
  const can = (p: Parameters<typeof hasSitePermission>[1]) => hasSitePermission(access.perms, p);

  const [result, owners, amenities] = await Promise.all([
    getSite(id),
    access.actor.isSuperadmin ? listOwnerOptions() : Promise.resolve(null),
    getAmenityAssignments(id),
  ]);
  if (!result) notFound();

  const { site, units } = result;

  const lettable = units.filter((u) => u.status === "available");
  const seats = lettable.reduce((n, u) => n + Number(u.capacity ?? 0), 0);

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref={`/site/${param}`} />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-12 pt-20 md:pt-12">
        <nav className="text-sm text-ink-3 mb-4">
          <Link href="/site" className="hover:underline">Site</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-2">{site.name}</span>
        </nav>

        <header className="mb-8 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-ink">{site.name}</h1>
            <p className="text-ink-2 mt-1">
              {units.length} unit · {lettable.length} tersedia · kapasitas {seats}
            </p>
          </div>
          <div className="flex gap-2">
            {can("site.staff") && (
              <Link
                href={`/site/${site.slug}/staff`}
                className="px-4 py-2 rounded-lg border border-line-strong text-sm text-ink-2 hover:bg-white"
              >
                Staf
              </Link>
            )}
            {can("site.members.view") && <Link
              href={`/site/${site.slug}/members`}
              className="px-4 py-2 rounded-lg border border-line-strong text-sm text-ink-2 hover:bg-white"
            >
              Member
            </Link>}
            {can("site.reservations.view") && <Link
              href={`/site/${site.slug}/calendar`}
              className="px-4 py-2 rounded-lg border border-line-strong text-sm text-ink-2 hover:bg-white"
            >
              Kalender
            </Link>}
            <Link
              href={`/site/${site.slug}/dashboard`}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong"
            >
              Dashboard operator
            </Link>
          </div>
        </header>

        <SiteDetailForm site={site} owners={owners} canEdit={can("site.settings")} />

        <UnitManager siteId={site.id} units={units} canEdit={can("site.units")} />

        {(can("site.settings") || can("site.units")) && (
          <AmenityManager
            siteId={site.id} units={units} assignments={amenities}
            canEditSite={can("site.settings")} canEditUnits={can("site.units")}
          />
        )}
      </main>
    </div>
  );
}
