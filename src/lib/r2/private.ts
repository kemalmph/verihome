import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const privateClient = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const PRIVATE_BUCKET = process.env.CLOUDFLARE_R2_PRIVATE_BUCKET!;

export async function uploadPrivate(
  file: Buffer,
  key: string,
  contentType: string
): Promise<void> {
  await privateClient.send(
    new PutObjectCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );
}

/** Returns a presigned GET URL valid for 15 minutes. */
export async function presignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    privateClient,
    new GetObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }),
    { expiresIn: 900 }
  );
}
