import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getStorageBucket(): string {
  return (
    process.env.EXPORTS_S3_BUCKET ||
    process.env.R2_BUCKET ||
    process.env.S3_BUCKET ||
    ""
  );
}

function getStorageEndpoint(): string | undefined {
  return process.env.R2_ENDPOINT || process.env.S3_ENDPOINT || undefined;
}

function getStorageRegion(): string {
  return process.env.AWS_REGION || process.env.S3_REGION || "auto";
}

function getStorageCredentials():
  | { accessKeyId: string; secretAccessKey: string }
  | undefined {
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }

  return undefined;
}

function getS3Client(): S3Client {
  const endpoint = getStorageEndpoint();
  return new S3Client({
    region: getStorageRegion(),
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: getStorageCredentials(),
  });
}

export async function writeExportFile(
  companyId: string,
  filename: string,
  data: string,
): Promise<{ filePath: string; size: number }> {
  const bucket = getStorageBucket();
  if (!bucket) throw new Error("Storage bucket is not configured");
  const key = `exports/${companyId}/${filename}`;

  const client = getS3Client();

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: "text/csv",
  });

  await client.send(cmd);

  return { filePath: key, size: Buffer.byteLength(data) };
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 300,
): Promise<string> {
  const bucket = getStorageBucket();
  if (!bucket) throw new Error("Storage bucket is not configured");

  const client = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
}

export async function getSignedUploadUrl(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const bucket = getStorageBucket();
  if (!bucket) throw new Error("Storage bucket is not configured");

  const client = getS3Client();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
  });

  return getSignedUrl(client, cmd, {
    expiresIn: input.expiresInSeconds ?? 300,
  });
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = getStorageBucket();
  if (!bucket) throw new Error("Storage bucket is not configured");

  const client = getS3Client();
  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(cmd);
}
