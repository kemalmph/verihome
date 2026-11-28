import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSiteAccess, siteIdOf } from "@/lib/auth/site-access";
import { canSeeDocumentKind } from "@/lib/auth/site-permissions";
import { uploadPrivate, presignedGetUrl } from "@/lib/r2/private";
import { sanitizeFilename } from "@/lib/r2/upload";

/**
 * Contract paperwork.
 *
 * Private bucket, key stored, URL minted only on request and only for fifteen
 * minutes. A signed lease names people, addresses and money; it has no
 * business behind a URL that works forever for anyone who has ever seen it.
 *
 * Phase 3: the site is always derived from what the document hangs on — the
 * reservation's unit's site, the unit's site, or (for a site document) the
 * site itself. A site_id sent alongside a reservation or unit is only a
 * claim; when it disagrees, not-found. Every refusal is the same 404 as a
 * record that does not exist.
 */

const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * What a document can be. A closed list, checked on the server.
 *
 * The browser supplies Content-Type; it is not measured, so this is a filter
 * and not a guarantee. It is worth having anyway, and it is not the only
 * defence: nothing is served from this bucket as a page — downloads go out
 * through a presigned link, so a file that lies about being a PDF is still
 * only a file sitting in object storage.
 */
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const KINDS = new Set([
  "contract", "amendment", "invoice", "receipt",
  "id_card", "floor_plan", "certificate", "other",
]);

export async function POST(req: NextRequest) {
  let fd: FormData;
  try { fd = await req.formData(); } catch { return notFound(); }

  const reservation_id = ((fd.get("reservation_id") as string) ?? "").trim() || null;
  const unit_id = ((fd.get("unit_id") as string) ?? "").trim() || null;
  const claimedSite = ((fd.get("site_id") as string) ?? "").trim() || null;

  if (reservation_id && unit_id) {
    return NextResponse.json(
      { error: "Dokumen harus menempel pada tepat satu: kontrak, unit, atau site." },
      { status: 400 },
    );
  }

  // The site, from the database: the reservation's or the unit's, or for a
  // site document the site itself. Access is checked before anything about
  // the file is looked at, so a refused caller learns nothing from the reply.
  const siteId = reservation_id
    ? await siteIdOf("reservation", reservation_id)
    : unit_id
      ? await siteIdOf("unit", unit_id)
      : claimedSite;
  if (!siteId || (claimedSite && claimedSite !== siteId)) return notFound();

  let caller;
  try { caller = (await requireSiteAccess(siteId, "site.documents")).actor; } catch { return notFound(); }

  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Tidak ada berkas." }, { status: 400 });

  if (file.size === 0) return NextResponse.json({ error: "Berkas kosong." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Berkas lebih dari 20 MB." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `Tipe berkas ${file.type || "tidak dikenal"} tidak diterima. PDF, gambar, atau Word.` },
      { status: 400 },
    );
  }

  const kind = (fd.get("kind") as string) || "contract";
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Jenis dokumen tidak dikenal." }, { status: 400 });
  }

  // Exactly one owner on the row (the table's CHECK): the most specific one.
  // The site, reservation or unit is known to exist — siteIdOf read it.
  const site_id = reservation_id || unit_id ? null : siteId;
  const owners = [reservation_id, unit_id, site_id].filter(Boolean);

  const admin = createAdminClient();

  const scope = reservation_id ? "reservations" : unit_id ? "units" : "sites";
  const key = `coworking/${scope}/${owners[0]}/${Date.now()}-${sanitizeFilename(file.name)}`;

  try {
    await uploadPrivate(Buffer.from(await file.arrayBuffer()), key, file.type);
  } catch (e) {
    return NextResponse.json({ error: `Gagal mengunggah: ${(e as Error).message}` }, { status: 502 });
  }

  const { data, error } = await admin
    .from("coworking_documents")
    .insert({
      site_id, unit_id, reservation_id,
      kind,
      title: ((fd.get("title") as string) ?? "").trim() || null,
      file_key: key,
      file_name: file.name,
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by: caller.userId,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}

/** A fifteen-minute link to one document. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";

  // The document's site, from the document. Finance (site.documents.view)
  // opens invoices and receipts only; contracts and IDs need site.documents.
  const siteId = await siteIdOf("document", id);
  if (!siteId) return notFound();
  let perms;
  try { perms = (await requireSiteAccess(siteId, ["site.documents", "site.documents.view"])).perms; }
  catch { return notFound(); }

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("coworking_documents").select("file_key, file_name, kind").eq("id", id).maybeSingle();
  if (!doc || !canSeeDocumentKind(perms, doc.kind)) return notFound();

  const url = await presignedGetUrl(doc.file_key);
  return NextResponse.json({ url, file_name: doc.file_name });
}
