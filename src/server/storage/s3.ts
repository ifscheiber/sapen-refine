import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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

export async function statObject(key: string) {
  const response = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return {
    contentLength: response.ContentLength ?? null,
    contentType: response.ContentType ?? null,
    etag: response.ETag ?? null,
  };
}

export async function verifyStoredObject(params: {
  key: string;
  size?: number;
  contentType?: string | null;
}) {
  const stat = await statObject(params.key);
  if (params.size !== undefined && stat.contentLength !== params.size) {
    throw new Error("OBJECT_STAT_SIZE_MISMATCH");
  }
  if (
    params.contentType &&
    stat.contentType &&
    stat.contentType.split(";")[0]?.toLowerCase() !== params.contentType.split(";")[0]?.toLowerCase()
  ) {
    throw new Error("OBJECT_STAT_CONTENT_TYPE_MISMATCH");
  }
  return stat;
}

export async function deleteObjectBestEffort(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const response = await s3.send(cmd);
  if (!response.Body) {
    throw new Error("Storage object response body is empty");
  }
  return response.Body.transformToByteArray();
}

export async function checkStorageReady() {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
}
