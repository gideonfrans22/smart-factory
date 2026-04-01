import type ExcelJS from "exceljs";
import type { ParsedRawMaterialData } from "../raw-material.import.service";

export interface ExcelRawMaterialPort {
  generateTemplate(lang?: "en" | "ko"): Promise<ExcelJS.Workbook>;
  parseWorkbook(
    buffer: Buffer | Uint8Array | ArrayBuffer
  ): Promise<ParsedRawMaterialData>;
}

