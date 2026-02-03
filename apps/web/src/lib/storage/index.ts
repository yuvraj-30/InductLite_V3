export { writeExportFile as writeLocalExportFile } from "./local";
export { writeExportFile as writeS3ExportFile } from "./s3";

export async function writeExportFile(
  companyId: string,
  filename: string,
  data: string,
) {
  const mode = (process.env.STORAGE_MODE || "local").toLowerCase();
  if (mode === "s3") {
    const mod = await import("./s3");
    return mod.writeExportFile(companyId, filename, data);
  }
  const mod = await import("./local");
  return mod.writeExportFile(companyId, filename, data);
}
