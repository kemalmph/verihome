/**
 * One-time migration: move payment-proofs/* from the public verihome-media
 * bucket to the private verihome-private bucket, then update DB rows.
 *
 * Usage:
 *   node scripts/migrate-proofs-to-private.js
 *
 * Reads credentials from env — easiest to run with dotenv-cli:
 *   npx dotenv -e .env.local -- node scripts/migrate-proofs-to-private.js
 *
 * What it does:
 *   1. Lists all objects under payment-proofs/ in the public bucket
 *   2. Copies each to the private bucket at the same key
 *   3. Deletes the source from the public bucket
 *   4. Updates bookings.payment_proof_url and viewings.payment_proof_url
 *      rows that still hold a full https:// URL → replaces with the key only
 *   5. Prints a summary
 *
 * Safe to re-run: copy is idempotent, delete only fires after a successful copy,
 * and DB update uses WHERE payment_proof_url LIKE 'https://%'.
 */

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const ACCOUNT_ID  = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const ACCESS_KEY  = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_KEY  = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const PUB_BUCKET  = process.env.CLOUDFLARE_R2_BUCKET_NAME;       // verihome-media
const PRIV_BUCKET = process.env.CLOUDFLARE_R2_PRIVATE_BUCKET;    // verihome-private
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [k, v] of Object.entries({ ACCOUNT_ID, ACCESS_KEY, SECRET_KEY, PUB_BUCKET, PRIV_BUCKET, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function listAll(prefix) {
  const keys = [];
  let token;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: PUB_BUCKET, Prefix: prefix, ContinuationToken: token,
    }));
    for (const obj of res.Contents ?? []) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function copyObject(key) {
  // R2 supports server-side copy within the same account via CopyObject
  await client.send(new CopyObjectCommand({
    Bucket:     PRIV_BUCKET,
    Key:        key,
    CopySource: `${PUB_BUCKET}/${key}`,
  }));
}

async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket: PUB_BUCKET, Key: key }));
}

async function updateDbRows(publicUrlBase) {
  // Replace full public URLs with the key in both tables
  // publicUrlBase = e.g. "https://pub-xxx.r2.dev" or custom domain
  const tables = [
    { table: "bookings", col: "payment_proof_url" },
    { table: "viewings", col: "payment_proof_url" },
  ];

  let total = 0;
  for (const { table, col } of tables) {
    // Fetch rows that still have a full URL
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${col}`)
      .like(col, "https://%");

    if (error) { console.error(`  DB fetch ${table}:`, error.message); continue; }
    if (!data?.length) { console.log(`  ${table}: no URL rows to update`); continue; }

    for (const row of data) {
      const url = row[col];
      // Strip the base URL to get the key
      const key = url.startsWith(publicUrlBase + "/")
        ? url.slice(publicUrlBase.length + 1)
        : url.replace(/^https?:\/\/[^/]+\//, "");

      if (!key.startsWith("payment-proofs/")) {
        console.log(`  ${table}/${row.id}: skipping (not a proof URL): ${url}`);
        continue;
      }

      const { error: upErr } = await supabase
        .from(table)
        .update({ [col]: key })
        .eq("id", row.id);

      if (upErr) {
        console.error(`  ${table}/${row.id}: update failed:`, upErr.message);
      } else {
        console.log(`  ${table}/${row.id}: ${url} → ${key}`);
        total++;
      }
    }
  }
  return total;
}

async function main() {
  const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!PUBLIC_URL) { console.error("Missing CLOUDFLARE_R2_PUBLIC_URL"); process.exit(1); }

  console.log(`\nListing payment-proofs/ in public bucket: ${PUB_BUCKET}`);
  const keys = await listAll("payment-proofs/");
  console.log(`Found ${keys.length} object(s)\n`);

  let copied = 0, deleted = 0, failed = 0;

  for (const key of keys) {
    process.stdout.write(`  ${key} ... `);
    try {
      await copyObject(key);
      process.stdout.write("copied → ");
      await deleteObject(key);
      process.stdout.write("deleted\n");
      copied++; deleted++;
    } catch (err) {
      process.stdout.write(`FAILED: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\nBucket migration: ${copied} copied, ${deleted} deleted, ${failed} failed`);

  console.log("\nUpdating DB rows (full URL → object key) ...");
  const dbUpdated = await updateDbRows(PUBLIC_URL);
  console.log(`DB rows updated: ${dbUpdated}`);

  console.log("\nDone. Verify:\n  - payment-proofs/ no longer appears in verihome-media\n  - payment_proof_url DB values no longer start with https://");
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
