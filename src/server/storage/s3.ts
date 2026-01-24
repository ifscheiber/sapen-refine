import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT!;
const accessKeyId = process.env.S3_ACCESS_KEY!;
const secretAccessKey = process.env.S3_SECRET_KEY!;
const region = process.env.S3_REGION || "us-east-1";
const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || "true") === "true";

export const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials: { accessKeyId, secretAccessKey },
});

export const bucket = process.env.S3_BUCKET!;

export async function presignPutObject(key: string, contentType: string, expiresSeconds = 300) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
}

export async function presignGetObject(key: string, expiresSeconds = 300) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
}
