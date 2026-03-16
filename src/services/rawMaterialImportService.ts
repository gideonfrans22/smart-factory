import ExcelJS from "exceljs";
import { RawMaterial } from "../models/RawMaterial";
import {
  COLORS,
  createInstructionBox,
  enableAutoFilter,
  freezePanes,
  styleHeaderRow
} from "./excelFormatService";
import {
  cellToNumber,
  cellToString,
  parseHeaderRow
} from "../utils/excelParseUtils";
import { ImportRowError } from "../types";

interface ParsedMaterial {
  rowNumber: number;
  materialCode: string;
  name: string;
  description?: string;
  supplier?: string;
  unit?: string;
  currentStock?: number;
}

interface ParsedSpecification {
  rowNumber: number;
  materialName: string;
  color?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  weight?: { value?: number; unit?: string };
  specSupplier?: string;
}

export interface ParsedRawMaterialData {
  materials: ParsedMaterial[];
  specifications: ParsedSpecification[];
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
        "- Fill in the 'Raw Materials' and 'Specifications' sheets as needed.",
        "- 'name' is the upsert key and must be unique within the Raw Materials sheet.",
        "- Import will update existing materials by name or create new ones if not found.",
        "- Specifications will be merged onto existing materials; duplicate specifications are skipped.",
        "- Do not delete or rename any sheets or headers.",
        "- 'currentStock' must be a non-negative number. Leave blank to keep default."
      ],
      ko: [
        "- 필요에 따라 Raw Materials 시트와 Specifications 시트를 작성하세요.",
        "- name 컬럼은 업서트 키이며, Raw Materials 시트 내에서 고유해야 합니다.",
        "- 가져오기 시 name으로 기존 원자재를 찾아 업데이트하고, 없으면 새로 생성합니다.",
        "- Specifications 데이터는 기존 원자재에 병합되며, 중복된 사양 행은 건너뜁니다.",
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

  // Sheet 1 — Instructions
  const instructionsSheet = workbook.addWorksheet("Instructions");
  instructionsSheet.properties.tabColor = { argb: COLORS.NEUTRAL };

  createInstructionBox(
    instructionsSheet,
    1,
    1,
    30,
    6,
    TRANSLATIONS.Instructions.title[lang],
    [
      ...TRANSLATIONS.Instructions.body[lang],
      "",
      `Generated: ${now.toISOString()}`
    ]
  );

  await instructionsSheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true
  });

  // Sheet 2 — Raw Materials
  const materialsSheet = workbook.addWorksheet("Raw Materials");
  materialsSheet.columns = [
    { header: "materialCode", key: "materialCode", width: 20 },
    { header: "name", key: "name", width: 30 },
    { header: "description", key: "description", width: 40 },
    { header: "supplier", key: "supplier", width: 25 },
    { header: "unit", key: "unit", width: 12 },
    { header: "currentStock", key: "currentStock", width: 15 }
  ];

  // Header row
  styleHeaderRow(materialsSheet, 1, materialsSheet.columns.length);
  freezePanes(materialsSheet);
  enableAutoFilter(materialsSheet, 1, 1, materialsSheet.columns.length);

  // Example row (row 2)
  const exampleRow = materialsSheet.addRow({
    materialCode: "AL",
    name: "Aluminum Sheet",
    description: "1mm thick",
    supplier: "POSCO",
    unit: "kg",
    currentStock: 500
  });
  exampleRow.font = { italic: true, color: { argb: "FF808080" } };

  // currentStock validation (whole number >= 0)
  materialsSheet
    .getColumn("F")
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

  // Sheet 3 — Specifications
  const specsSheet = workbook.addWorksheet("Specifications");
  specsSheet.columns = [
    { header: "materialName", key: "materialName", width: 30 },
    { header: "color", key: "color", width: 20 },
    { header: "dim_length", key: "dim_length", width: 15 },
    { header: "dim_width", key: "dim_width", width: 15 },
    { header: "dim_height", key: "dim_height", width: 15 },
    { header: "dim_unit", key: "dim_unit", width: 10 },
    { header: "weight_value", key: "weight_value", width: 15 },
    { header: "weight_unit", key: "weight_unit", width: 10 },
    { header: "spec_supplier", key: "spec_supplier", width: 25 }
  ];

  styleHeaderRow(specsSheet, 1, specsSheet.columns.length);
  freezePanes(specsSheet);
  enableAutoFilter(specsSheet, 1, 1, specsSheet.columns.length);

  const specsExampleRow = specsSheet.addRow({
    materialName: "Aluminum Sheet",
    color: "Silver",
    dim_length: 1000,
    dim_width: 500,
    dim_height: 1,
    dim_unit: "mm",
    weight_value: 10,
    weight_unit: "kg",
    spec_supplier: "POSCO"
  });
  specsExampleRow.font = { italic: true, color: { argb: "FF808080" } };

  // Dropdown validation for dim_unit
  specsSheet
    .getColumn("F")
    .eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= 3 && rowNumber <= 1048576) {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"mm,cm,m,inch"']
        };
      }
    });

  // Dropdown validation for weight_unit
  specsSheet
    .getColumn("H")
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
  const specsSheet = workbook.getWorksheet("Specifications");

  if (!materialsSheet) {
    errors.push({
      sheet: "Raw Materials",
      row: 1,
      message: "Sheet 'Raw Materials' not found.",
      severity: "error"
    });
  }

  if (!specsSheet) {
    errors.push({
      sheet: "Specifications",
      row: 1,
      message: "Sheet 'Specifications' not found.",
      severity: "error"
    });
  }

  if (!materialsSheet || !specsSheet) {
    return { materials: [], specifications: [], errors };
  }

  if (materialsSheet.rowCount - 1 > MAX_ROWS_PER_SHEET) {
    errors.push({
      sheet: "Raw Materials",
      row: 0,
      message: `Too many rows. Maximum allowed is ${MAX_ROWS_PER_SHEET}.`,
      severity: "error"
    });
  }

  if (specsSheet.rowCount - 1 > MAX_ROWS_PER_SHEET) {
    errors.push({
      sheet: "Specifications",
      row: 0,
      message: `Too many rows. Maximum allowed is ${MAX_ROWS_PER_SHEET}.`,
      severity: "error"
    });
  }

  const materials: ParsedMaterial[] = [];
  const specifications: ParsedSpecification[] = [];

  const materialHeaderMap = parseHeaderRow(materialsSheet, 1);
  const specsHeaderMap = parseHeaderRow(specsSheet, 1);

  const seenNames = new Set<string>();

  // Parse Raw Materials sheet
  for (let rowNumber = 3; rowNumber <= materialsSheet.rowCount; rowNumber++) {
    const row = materialsSheet.getRow(rowNumber);
    const nameCellIndex = materialHeaderMap.get("name");
    const nameValue =
      nameCellIndex != null ? cellToString(row.getCell(nameCellIndex)) : null;

    // Skip blank primary key rows
    if (!nameValue) {
      continue;
    }

    const materialCodeIndex = materialHeaderMap.get("materialCode");
    const materialCode =
      materialCodeIndex != null
        ? cellToString(row.getCell(materialCodeIndex))
        : null;

    if (!materialCode) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "materialCode",
        message: "materialCode is required.",
        severity: "error"
      });
    }

    if (seenNames.has(nameValue)) {
      errors.push({
        sheet: "Raw Materials",
        row: rowNumber,
        column: "name",
        message: `Duplicate name '${nameValue}' found in file.`,
        severity: "error"
      });
    } else {
      seenNames.add(nameValue);
    }

    const descriptionIndex = materialHeaderMap.get("description");
    const supplierIndex = materialHeaderMap.get("supplier");
    const unitIndex = materialHeaderMap.get("unit");
    const currentStockIndex = materialHeaderMap.get("currentStock");

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

    materials.push({
      rowNumber,
      materialCode: (materialCode ?? "").toUpperCase(),
      name: nameValue.trim(),
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

  // Preload material names from DB for specifications validation
  const dbMaterials = await RawMaterial.find({}, { name: 1 }).lean();
  const dbMaterialNames = new Set<string>(
    dbMaterials.map((m) => (m as any).name)
  );

  // Parse Specifications sheet
  for (let rowNumber = 2; rowNumber <= specsSheet.rowCount; rowNumber++) {
    const row = specsSheet.getRow(rowNumber);
    const materialNameIndex = specsHeaderMap.get("materialName");
    const materialName =
      materialNameIndex != null
        ? cellToString(row.getCell(materialNameIndex))
        : null;

    if (!materialName) {
      continue;
    }

    const existsInFile = seenNames.has(materialName);
    const existsInDb = dbMaterialNames.has(materialName);

    if (!existsInFile && !existsInDb) {
      errors.push({
        sheet: "Specifications",
        row: rowNumber,
        column: "materialName",
        message: `materialName '${materialName}' not found in file or database.`,
        severity: "error"
      });
    }

    const colorIndex = specsHeaderMap.get("color");
    const dimLengthIndex = specsHeaderMap.get("dim_length");
    const dimWidthIndex = specsHeaderMap.get("dim_width");
    const dimHeightIndex = specsHeaderMap.get("dim_height");
    const dimUnitIndex = specsHeaderMap.get("dim_unit");
    const weightValueIndex = specsHeaderMap.get("weight_value");
    const weightUnitIndex = specsHeaderMap.get("weight_unit");
    const specSupplierIndex = specsHeaderMap.get("spec_supplier");

    const color =
      colorIndex != null
        ? cellToString(row.getCell(colorIndex)) ?? undefined
        : undefined;
    const dimLength =
      dimLengthIndex != null
        ? cellToNumber(row.getCell(dimLengthIndex)) ?? undefined
        : undefined;
    const dimWidth =
      dimWidthIndex != null
        ? cellToNumber(row.getCell(dimWidthIndex)) ?? undefined
        : undefined;
    const dimHeight =
      dimHeightIndex != null
        ? cellToNumber(row.getCell(dimHeightIndex)) ?? undefined
        : undefined;
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
    const specSupplier =
      specSupplierIndex != null
        ? cellToString(row.getCell(specSupplierIndex)) ?? undefined
        : undefined;

    const hasAnyDetail =
      !!color ||
      dimLength !== undefined ||
      dimWidth !== undefined ||
      dimHeight !== undefined ||
      !!dimUnit ||
      weightValue !== undefined ||
      !!weightUnit ||
      !!specSupplier;

    if (!hasAnyDetail) {
      errors.push({
        sheet: "Specifications",
        row: rowNumber,
        message:
          "Specification row has materialName but no spec details; it will be ignored.",
        severity: "warning"
      });
    }

    if (dimUnit && !["mm", "cm", "m", "inch"].includes(dimUnit)) {
      errors.push({
        sheet: "Specifications",
        row: rowNumber,
        column: "dim_unit",
        message: "dim_unit must be one of: mm, cm, m, inch.",
        severity: "error"
      });
    }

    if (weightUnit && !["kg", "g", "lb", "oz"].includes(weightUnit)) {
      errors.push({
        sheet: "Specifications",
        row: rowNumber,
        column: "weight_unit",
        message: "weight_unit must be one of: kg, g, lb, oz.",
        severity: "error"
      });
    }

    specifications.push({
      rowNumber,
      materialName,
      color,
      dimensions:
        dimLength !== undefined ||
        dimWidth !== undefined ||
        dimHeight !== undefined ||
        dimUnit
          ? {
              length: dimLength,
              width: dimWidth,
              height: dimHeight,
              unit: dimUnit
            }
          : undefined,
      weight:
        weightValue !== undefined || weightUnit
          ? {
              value: weightValue,
              unit: weightUnit
            }
          : undefined,
      specSupplier
    });
  }

  return { materials, specifications, errors };
}
