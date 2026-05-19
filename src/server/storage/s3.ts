import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getRuntimeConfig } from "@/server/runtime/config";

const storageConfig = getRuntimeConfig().s3;

export const s3 = new S3Client({
  region: storageConfig.region,
  endpoint: storageConfig.endpoint,
  forcePathStyle: storageConfig.forcePathStyle,
  credentials: {
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey,
  },
});

export const bucket = storageConfig.bucket;

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

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3.send(cmd);
}

export async function checkStorageReady() {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
}
