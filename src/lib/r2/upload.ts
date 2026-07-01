import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "./client";

export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

export function buildR2Key(
  propertyId: string,
  category: string,
  filename: string
): string {
  const safe = sanitizeFilename(filename);
  const ts = Date.now();
  return `properties/${propertyId}/${category}/${ts}-${safe}`;
}

export function getR2Url(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );
  return getR2Url(key);
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}

export function keyFromUrl(url: string): string {
  const base = R2_PUBLIC_URL.endsWith("/") ? R2_PUBLIC_URL : R2_PUBLIC_URL + "/";
  return url.startsWith(base) ? url.slice(base.length) : url;
}
