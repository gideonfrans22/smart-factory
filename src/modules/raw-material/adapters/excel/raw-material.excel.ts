import ExcelJS from "exceljs";
import {
  COLORS,
  createInstructionBox,
  enableAutoFilter,
  freezePanes,
  styleHeaderRow
} from "@shared/services/excelFormatService";
import { cellToNumber, cellToString, parseHeaderRow } from "@shared/utils";
import type { ImportRowError } from "@shared/types";
import type { ExcelRawMaterialPort } from "../../ports/ExcelRawMaterialPort";

export interface ParsedMaterial {
  rowNumber: number;
  materialTypeCode: string;
  materialTypeName: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit?: string;
  };
  weight?: { value?: number; unit?: string };
  color?: string;
  description?: string;
  supplier?: string;
  unit?: string;
  currentStock?: number;
}

export interface ParsedRawMaterialData {
  materials: ParsedMaterial[];
  errors: ImportRowError[];
}

const MAX_ROWS_PER_SHEET = 500;

const TRANSLATIONS = {
  Instructions: {
    title: {
      en: "Raw Material Import Instructions",
      ko: "원자재 가져오기 안내"
    },
    body: {
      en: [
        "- Fill in the 'Raw Materials' sheet. One row = one raw material.",
        "- materialTypeCode and materialTypeName are required. If no matching type exists, a new type will be created.",
        "- Dimensions (dim_length, dim_width, dim_height) are required and used as the upsert key together with the material type.",
        "- Do not delete or rename any sheets or headers.",
        "- 'currentStock' must be a non-negative number. Leave blank to keep default."
      ],
      ko: [
        "- Raw Materials 시트를 작성하세요. 한 행 = 한 개의 원자재입니다.",
        "- materialTypeCode 및 materialTypeName은 필수입니다. 일치하는 타입이 없으면 새로 생성됩니다.",
        "- Dimensions(dim_length, dim_width, dim_height)은 필수이며, 원자재 타입과 함께 업서트 키로 사용됩니다.",
        "- 어떤 시트나 헤더도 삭제하거나 이름을 변경하지 마세요.",
        "- currentStock 값은 0 이상인 숫자여야 합니다. 기본값을 유지하려면 비워 두세요."
      ]
    }
  },
  dataValidation: {
    currentStock: {
      en: "currentStock must be a non-negative number. Leave blank to keep default.",
      ko: "currentStock 값은 0 이상인 숫자여야 합니다. 기본값을 유지하려면 비워 두세요."
    }
  }
};

export async function generateRawMaterialTemplate(
  lang: "en" | "ko" = "ko"
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Smart Factory";
  workbook.lastModifiedBy = "Smart Factory";
  const now = new Date();
  workbook.created = now;
  workbook.modified = now;

  const instructionsSheet = workbook.addWorksheet("Instructions");
  instructionsSheet.properties.tabColor = { argb: COLORS.NEUTRAL };

  createInstructionBox(
    instructionsSheet,
    1,
    1,
    30,
    6,
    TRANSLATIONS.Instructions.title[lang],
    [...TRANSLATIONS.Instructions.body[lang], "", `Generated: ${now.toISOString()}`]
  );

  await instructionsSheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true
  });

  const materialsSheet = workbook.addWorksheet("Raw Materials");
  materialsSheet.columns = [
    { header: "materialTypeCode", key: "materialTypeCode", width: 20 },
    { header: "materialTypeName", key: "materialTypeName", width: 30 },
    { header: "description", key: "description", width: 40 },
    { header: "supplier", key: "supplier", width: 25 },
    { header: "unit", key: "unit", width: 12 },
    { header: "currentStock", key: "currentStock", width: 15 },
    { header: "color", key: "color", width: 20 },
    { header: "dim_length", key: "dim_length", width: 15 },
    { header: "dim_width", key: "dim_width", width: 15 },
    { header: "dim_height", key: "dim_height", width: 15 },
    { header: "dim_unit", key: "dim_unit", width: 10 },
    { header: "weight_value", key: "weight_value", width: 15 },
    { header: "weight_unit", key: "weight_unit", width: 10 }
  ];

  styleHeaderRow(materialsSheet, 1, materialsSheet.columns.length);
  freezePanes(materialsSheet);
  enableAutoFilter(materialsSheet, 1, 1, materialsSheet.columns.length);

  const exampleRow = materialsSheet.addRow({
    materialTypeCode: "AL",
    materialTypeName: "Aluminum",
    description: "1mm thick",
    supplier: "POSCO",
    unit: "kg",
    currentStock: 500,
    color: "Silver",
    dim_length: 1000,
    dim_width: 500,
    dim_height: 1,
    dim_unit: "mm",
    weight_value: 10,
    weight_unit: "kg"
  });
  exampleRow.font = { italic: true, color: { argb: "FF808080" } };

  const currentStockCol =
    materialsSheet.getColumn("currentStock").letter ?? "F";
  materialsSheet
    .getColumn(currentStockCol)
    .eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= 3 && rowNumber <= 1048576) {
        cell.dataValidation = {
          type: "whole",
          operator: "greaterThanOrEqual",
          formulae: [0],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.currentStock[lang]
        };
      }
    });

  const dimUnitCol = materialsSheet.getColumn("dim_unit").letter ?? "K";
  materialsSheet
    .getColumn(dimUnitCol)
    .eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= 3 && rowNumber <= 1048576) {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"mm,cm,m,inch"']
        };
      }
    });

  const weightUnitCol = materialsSheet.getColumn("weight_unit").letter ?? "M";
  materialsSheet
    .getColumn(weightUnitCol)
    .eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= 3 && rowNumber <= 1048576) {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"kg,g,lb,oz"']
        };
      }
    });

  return workbook;
}

export async function parseRawMaterialWorkbook(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<ParsedRawMaterialData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const errors: ImportRowError[] = [];

  const materialsSheet = workbook.getWorksheet("Raw Materials");

  if (!materialsSheet) {
    errors.push({
      sheet: "Raw Materials",
      row: 1,
      message: "Sheet 'Raw Materials' not found.",
      severity: "error"
    });
  }
  if (!materialsSheet) {
    return { materials: [], errors };
  }

  if (materialsSheet.rowCount - 1 > MAX_ROWS_PER_SHEET) {
    errors.push({
      sheet: "Raw Materials",
      row: 0,
      message: `Too many rows. Maximum allowed is ${MAX_ROWS_PER_SHEET}.`,
      severity: "error"
    });
  }

  const materials: ParsedMaterial[] = [];

  const materialHeaderMap = parseHeaderRow(materialsSheet, 1);

  for (let rowNumber = 3; rowNumber <= materialsSheet.rowCount; rowNumber++) {
    const row = materialsSheet.getRow(rowNumber);
    const materialTypeCodeIndex = materialHeaderMap.get("materialTypeCode");
    const materialTypeNameIndex = materialHeaderMap.get("materialTypeName");
    const materialTypeCode =
      materialTypeCodeIndex != null
        ? cellToString(row.getCell(materialTypeCodeIndex))
        : null;
    const materialTypeName =
      materialTypeNameIndex != null
        ? cellToString(row.getCell(materialTypeNameIndex))
        : null;

    const isEmptyRow = !materialTypeCode && !materialTypeName;
    if (isEmptyRow) {
      continue;
    }

    if (!materialTypeCode) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "materialTypeCode",
        message: "materialTypeCode is required.",
        severity: "error"
      });
    }

    if (!materialTypeName) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "materialTypeName",
        message: "materialTypeName is required.",
        severity: "error"
      });
    }

    const descriptionIndex = materialHeaderMap.get("description");
    const supplierIndex = materialHeaderMap.get("supplier");
    const unitIndex = materialHeaderMap.get("unit");
    const currentStockIndex = materialHeaderMap.get("currentStock");
    const colorIndex = materialHeaderMap.get("color");
    const dimLengthIndex = materialHeaderMap.get("dim_length");
    const dimWidthIndex = materialHeaderMap.get("dim_width");
    const dimHeightIndex = materialHeaderMap.get("dim_height");
    const dimUnitIndex = materialHeaderMap.get("dim_unit");
    const weightValueIndex = materialHeaderMap.get("weight_value");
    const weightUnitIndex = materialHeaderMap.get("weight_unit");

    const currentStock =
      currentStockIndex != null
        ? cellToNumber(row.getCell(currentStockIndex))
        : null;

    if (
      currentStock != null &&
      (Number.isNaN(currentStock) || currentStock < 0)
    ) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "currentStock",
        message: "currentStock must be a non-negative number.",
        severity: "error"
      });
    }

    const dimLength =
      dimLengthIndex != null
        ? cellToNumber(row.getCell(dimLengthIndex))
        : null;
    const dimWidth =
      dimWidthIndex != null ? cellToNumber(row.getCell(dimWidthIndex)) : null;
    const dimHeight =
      dimHeightIndex != null
        ? cellToNumber(row.getCell(dimHeightIndex))
        : null;
    const dimUnit =
      dimUnitIndex != null
        ? cellToString(row.getCell(dimUnitIndex)) ?? undefined
        : undefined;
    const weightValue =
      weightValueIndex != null
        ? cellToNumber(row.getCell(weightValueIndex)) ?? undefined
        : undefined;
    const weightUnit =
      weightUnitIndex != null
        ? cellToString(row.getCell(weightUnitIndex)) ?? undefined
        : undefined;
    const color =
      colorIndex != null
        ? cellToString(row.getCell(colorIndex)) ?? undefined
        : undefined;

    if (dimLength == null || Number.isNaN(dimLength)) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "dim_length",
        message: "dim_length is required and must be a number.",
        severity: "error"
      });
    }
    if (dimWidth == null || Number.isNaN(dimWidth)) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "dim_width",
        message: "dim_width is required and must be a number.",
        severity: "error"
      });
    }
    if (dimHeight == null || Number.isNaN(dimHeight)) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "dim_height",
        message: "dim_height is required and must be a number.",
        severity: "error"
      });
    }

    if (dimUnit && !["mm", "cm", "m", "inch"].includes(dimUnit)) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "dim_unit",
        message: "dim_unit must be one of: mm, cm, m, inch.",
        severity: "error"
      });
    }

    if (weightUnit && !["kg", "g", "lb", "oz"].includes(weightUnit)) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "weight_unit",
        message: "weight_unit must be one of: kg, g, lb, oz.",
        severity: "error"
      });
    }

    materials.push({
      rowNumber,
      materialTypeCode: (materialTypeCode ?? "").trim().toUpperCase(),
      materialTypeName: (materialTypeName ?? "").trim(),
      dimensions: {
        length: (dimLength ?? undefined) as any,
        width: (dimWidth ?? undefined) as any,
        height: (dimHeight ?? undefined) as any,
        unit: dimUnit
      },
      color,
      weight:
        weightValue !== undefined || weightUnit
          ? { value: weightValue, unit: weightUnit }
          : undefined,
      description:
        descriptionIndex != null
          ? cellToString(row.getCell(descriptionIndex)) ?? undefined
          : undefined,
      supplier:
        supplierIndex != null
          ? cellToString(row.getCell(supplierIndex)) ?? undefined
          : undefined,
      unit:
        unitIndex != null
          ? cellToString(row.getCell(unitIndex)) ?? undefined
          : undefined,
      currentStock: currentStock ?? undefined
    });
  }

  return { materials, errors };
}

export const excelRawMaterialAdapter: ExcelRawMaterialPort = {
  generateTemplate: generateRawMaterialTemplate,
  parseWorkbook: parseRawMaterialWorkbook
};

export const excelRawMaterial = {
  generateRawMaterialTemplate,
  parseRawMaterialWorkbook
};

