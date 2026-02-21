export {
  writeExportFile as writeLocalExportFile,
  deleteObject as deleteLocalObject,
} from "./local";
export {
  writeExportFile as writeS3ExportFile,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  deleteObject as deleteS3Object,
  readObjectBytes as readS3ObjectBytes,
} from "./s3";

export async function writeExportFile(
  companyId: string,
  filename: string,
  data: string | Buffer,
  contentType: string = "text/csv",
) {
  const mode = (process.env.STORAGE_MODE || "local").toLowerCase();
  if (mode === "s3") {
    const mod = await import("./s3");
    return mod.writeExportFile(companyId, filename, data, contentType);
  }
  const mod = await import("./local");
  return mod.writeExportFile(companyId, filename, data, contentType);
}

export async function deleteObject(filePathOrKey: string) {
  const mode = (process.env.STORAGE_MODE || "local").toLowerCase();
  if (mode === "s3") {
    const mod = await import("./s3");
    return mod.deleteObject(filePathOrKey);
  }
  const mod = await import("./local");
  return mod.deleteObject(filePathOrKey);
}
