import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function writeExportFile(
  companyId: string,
  filename: string,
  data: string,
): Promise<{ filePath: string; size: number }> {
  const bucket = process.env.EXPORTS_S3_BUCKET;
  if (!bucket) throw new Error("EXPORTS_S3_BUCKET is not configured");
  const key = `exports/${companyId}/${filename}`;

  const client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: "text/csv",
  });

  await client.send(cmd);

  return { filePath: `s3://${bucket}/${key}`, size: Buffer.byteLength(data) };
}
