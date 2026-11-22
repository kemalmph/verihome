import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Turning a readable URL segment back into a row.
 *
 * /admin/coworking/coco-lokalima/dashboard reads like something a person
 * wrote down; /admin/coworking/4fdac801-6383-4473-9707-ee41729b5b22/dashboard
 * is a thing you can only arrive at by clicking. Slugs and contract codes are
 * already unique, so they can carry the route.
 *
 * Both resolvers still accept a uuid. Links that already exist — in a chat, a
 * bookmark, an email from last week — must not start returning 404 because the
 * URL scheme improved. A uuid is unmistakable, so accepting both costs one
 * regex and no ambiguity.
 *
 * SERVER ONLY. This reaches the database with the service key; importing it
 * into a client component would be a build error, and should be.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const looksLikeUuid = (v: string) => UUID.test(v);

/** The site's id, given either its slug or its id. Null when neither matches. */
export async function resolveSiteId(param: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sites")
    .select("id")
    .eq(looksLikeUuid(param) ? "id" : "slug", param)
    .maybeSingle();
  return data?.id ?? null;
}

/** The reservation's id, given either its reservation_code or its id. */
export async function resolveReservationId(param: string): Promise<string | null> {
  const admin = createAdminClient();

  // Codes are generated upper-case (CW-20261122-699C), but a URL typed by
  // hand or lower-cased by a mail client should still land. ilike matches
  // without case, and the code has no wildcards in it to worry about.
  const { data } = looksLikeUuid(param)
    ? await admin.from("unit_reservations").select("id").eq("id", param).maybeSingle()
    : await admin.from("unit_reservations").select("id").ilike("reservation_code", param).maybeSingle();
  return data?.id ?? null;
}
