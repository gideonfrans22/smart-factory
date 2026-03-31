import { loggerService } from "@/shared/services";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

/**
 * Save workbook to file system
 * Ensures uploads/reports directory exists
 */
export async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  fileName: string
): Promise<string> {
  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), "uploads", "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    loggerService.info(
      `[ReportGeneration] Created reports directory: ${reportsDir}`
    );
  }

  // Generate full file path
  const filePath = path.join(reportsDir, fileName);

  // Write workbook to file
  await workbook.xlsx.writeFile(filePath);

  loggerService.info(`[ReportGeneration] Saved workbook to: ${filePath}`);

  return filePath;
}
