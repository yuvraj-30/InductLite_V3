import fs from "fs/promises";
import path from "path";

export async function writeExportFile(
  companyId: string,
  filename: string,
  data: string,
): Promise<{ filePath: string; size: number }> {
  const dir = path.join(process.cwd(), ".storage", "exports", companyId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, data, "utf8");
  const stats = await fs.stat(filePath);
  return { filePath, size: stats.size };
}
