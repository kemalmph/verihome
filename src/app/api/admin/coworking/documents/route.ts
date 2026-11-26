import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadPrivate, presignedGetUrl } from "@/lib/r2/private";
import { sanitizeFilename } from "@/lib/r2/upload";

/**
 * Contract paperwork.
 *
 * Private bucket, key stored, URL minted only on request and only for fifteen
 * minutes. A signed lease names people, addresses and money; it has no
 * business behind a URL that works forever for anyone who has ever seen it.
 */

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
  let caller;
  try { caller = await requirePermission("sites.operate_all"); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const fd = await req.formData();
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

  const reservation_id = ((fd.get("reservation_id") as string) ?? "").trim() || null;
  const unit_id = ((fd.get("unit_id") as string) ?? "").trim() || null;
  const site_id = ((fd.get("site_id") as string) ?? "").trim() || null;

  const owners = [reservation_id, unit_id, site_id].filter(Boolean);
  if (owners.length !== 1) {
    return NextResponse.json(
      { error: "Dokumen harus menempel pada tepat satu: kontrak, unit, atau site." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // The owner must exist. A wrong-but-real id files someone's lease under
  // another tenant, which is worse than an error.
  const ownerCheck = reservation_id
    ? await admin.from("unit_reservations").select("id").eq("id", reservation_id).maybeSingle()
    : unit_id
      ? await admin.from("lettable_units").select("id").eq("id", unit_id).maybeSingle()
      : await admin.from("sites").select("id").eq("id", site_id!).maybeSingle();
  if (!ownerCheck.data) {
    return NextResponse.json({ error: "Kontrak, unit atau site tidak ditemukan." }, { status: 404 });
  }

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
      uploaded_by: caller.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}

/** A fifteen-minute link to one document. */
export async function GET(req: NextRequest) {
  try { await requirePermission("sites.operate_all"); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib." }, { status: 400 });

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("coworking_documents").select("file_key, file_name").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });

  const url = await presignedGetUrl(doc.file_key);
  return NextResponse.json({ url, file_name: doc.file_name });
}
