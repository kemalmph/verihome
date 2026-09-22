import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireOwner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadPrivate, presignedGetUrl } from "@/lib/r2/private";

const KINDS = new Set(["right_to_let", "cooperation_agreement"]);
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/**
 * Owner documents go to the PRIVATE bucket, like payment proofs, and are only
 * ever served through a short-lived presigned URL. Proof of right to let is a
 * legal document naming a real person; it has no business on a public bucket.
 *
 * The object key is derived from the owner id resolved by requireOwner(), never
 * from anything the client sends — a client-supplied key is a path the client
 * chooses, and it could choose someone else's.
 */
export async function POST(req: NextRequest) {
  let owner;
  try { owner = await requireOwner(); } catch { return NextResponse.json({ error: "Not found." }, { status: 404 }); }

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");

  if (!KINDS.has(kind)) return NextResponse.json({ error: "Jenis dokumen tidak dikenal." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Berkas maksimal 10 MB." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Hanya PDF atau gambar." }, { status: 400 });

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().slice(0, 5) : "bin";
  const key = `owner-documents/${owner.ownerId}/${kind}-${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadPrivate(buffer, key, file.type);

  const admin = createAdminClient();
  const { error } = await admin.from("owner_documents").insert({
    owner_id: owner.ownerId,
    kind,
    object_key: key,
    original_name: file.name.slice(0, 200),
    uploaded_by: owner.userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * Mints a presigned URL for one of the caller's own documents.
 *
 * Looked up by document id AND owner id in the same query, so another owner's
 * key can never be reached — and a miss is 404, not 403.
 */
export async function GET(req: NextRequest) {
  let owner;
  try { owner = await requireOwner(); } catch { return NextResponse.json({ error: "Not found." }, { status: 404 }); }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("owner_documents")
    .select("object_key")
    .eq("id", id)
    .eq("owner_id", owner.ownerId)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const url = await presignedGetUrl(data.object_key as string);
  return NextResponse.json({ url });
}
