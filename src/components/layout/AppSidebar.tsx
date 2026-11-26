import { SidebarShell, type ShellSection } from "./SidebarShell";
import { getNavContext } from "@/lib/nav/server";
import { activeItemHref, buildMenu, flattenMenu } from "@/lib/nav/menu";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

/**
 * The sidebar every /admin, /site, /survey and /owner page renders.
 *
 * Server component: it asks who is looking and hands the client shell only
 * the sections that person may see. It does not grant access — each page has
 * already enforced its own gate (requirePermissionOrRedirect / requireOwner)
 * before drawing this, and the gates stay separate on purpose: a property
 * owner who is not staff is still refused at /admin, and staff who are not
 * owners are still refused at /owner.
 *
 * `activeHref` is the page's path, plus the query that tells apart two menu
 * entries on one page (/admin/users?tab=admins).
 */
export async function AppSidebar({ activeHref }: { activeHref: string }) {
  const [ctx, lang] = await Promise.all([getNavContext(), getLocale()]);
  const sections = buildMenu(ctx);
  const current = activeItemHref(flattenMenu(sections), activeHref);

  const shellSections: ShellSection[] = sections.map((s) => ({
    id: s.id,
    heading: s.heading,
    groups: s.groups.map((g) => ({
      label: g.labelKey ? t(g.labelKey, lang) : g.label,
      items: g.items.map((i) => ({
        href: i.href,
        icon: i.icon,
        label: i.labelKey ? t(i.labelKey, lang) : i.label,
        active: i.href === current,
      })),
    })),
  }));

  // Staff screens have always been English (the admin is not translated), so
  // staff keep English chrome; an owner who is not staff gets the language
  // switch, as the owner portal's own sidebar did.
  const chrome = ctx.viewer ? "en" : lang;

  const staffOnlySurveys =
    !!ctx.viewer && ctx.viewer.permissions.every((p) => p === "surveys.input");
  const subtitle = ctx.viewer
    ? staffOnlySurveys ? "Surveyor" : "Admin Panel"
    : t("owner.portal", lang);

  return (
    <SidebarShell
      sections={shellSections}
      subtitle={subtitle}
      person={ctx.owner?.ownerName || ctx.viewer?.name || ctx.viewer?.email || undefined}
      labels={{
        menu: t("nav.menu", chrome),
        collapse: t("nav.sidebarCollapse", chrome),
        expand: t("nav.sidebarExpand", chrome),
        home: t("owner.access.home", chrome),
      }}
    />
  );
}
