import { prisma } from "@/lib/db/prisma";
import {
  generateSignInCsvForCompany,
  generateContractorCsvForCompany,
} from "./worker";
import { writeExportFile } from "@/lib/storage";

export async function processNextExportJob(): Promise<null | {
  id: string;
  status: string;
}> {
  const job = await prisma.exportJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { queued_at: "asc" },
  });

  if (!job) return null;

  await prisma.exportJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", started_at: new Date() },
  });

  try {
    let content = "";
    const filename = `${job.id}.csv`;

    // Special-case CONTRACTOR_CSV (P1): handle via runtime check so we can add the ExportType enum in a later migration
    if (String(job.export_type) === "CONTRACTOR_CSV") {
      content = await generateContractorCsvForCompany(job.company_id);
    } else {
      switch (job.export_type) {
        case "SIGN_IN_CSV":
          content = await generateSignInCsvForCompany(job.company_id);
          break;
        case "INDUCTION_CSV":
          // Placeholder for other export types
          content = "";
          break;
        default:
          throw new Error(`Unsupported export type: ${job.export_type}`);
      }
    }

    const { filePath, size } = await writeExportFile(
      job.company_id,
      filename,
      content,
    );

    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        completed_at: new Date(),
        file_path: filePath,
        file_name: filename,
        file_size: size,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      },
    });

    return { id: job.id, status: "SUCCEEDED" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error_message: message },
    });
    return { id: job.id, status: "FAILED" };
  }
}
