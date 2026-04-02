import ExcelJS from "exceljs";
import mongoose from "mongoose";
import { DeviceType } from "@modules/device-type";
import { Product } from "./product.model";
import { RawMaterial } from "@modules/raw-material";
import { ImportRowError } from "@shared/types";
import { cellToNumber, cellToString, parseHeaderRow } from "@shared/utils";
import {
  COLORS,
  createInstructionBox,
  enableAutoFilter,
  freezePanes,
  styleHeaderRow
} from "@shared/services/excelFormatService";
import { loggerService } from "@shared/services";

export interface ParsedProduct {
  rowNumber: number;
  designNumber: string;
  productName: string;
  customerName?: string;
  personInCharge?: string;
  department?: string;
  quantityUnit?: string;
}

export interface ParsedRecipeRow {
  rowNumber: number;
  recipeName: string;
  productDesignNumber: string;
  description?: string;
  dwgNo?: string;
  unit?: string;
  outsourcing?: string;
  remarks?: string;
}

export interface ParsedStepRow {
  rowNumber: number;
  recipeName: string;
  stepOrder: number;
  stepName: string;
  stepDescription?: string;
  estimatedDurationMin: number;
  deviceTypeName: string;
  qualityChecks: string[];
  dependsOnStepOrders: number[];
}

export interface ParsedRecipeMaterialRow {
  rowNumber: number;
  recipeName: string;
  /** Preferred: RawMaterial._id (hex), from RecipeMaterials.rawMaterialId */
  rawMaterialId: string;
  /** Legacy: resolved via RawMaterial.name when rawMaterialId is empty */
  materialName?: string;
  quantityRequired: number;
  spec: {
    color?: string;
    dim_length?: number;
    dim_width?: number;
    dim_height?: number;
    dim_unit?: string;
    weight_value?: number;
    weight_unit?: string;
  };
}

export interface ParsedProductData {
  products: ParsedProduct[];
  recipes: ParsedRecipeRow[];
  steps: ParsedStepRow[];
  recipeMaterials: ParsedRecipeMaterialRow[];
  errors: ImportRowError[];
}

const TRANSLATIONS = {
  Instructions: {
    title: {
      en: "Product & Recipe Import Instructions",
      ko: "제품 & 레시피 가져오기 안내"
    },
    body: {
      en: [
        "- Fill Products, Recipes, Steps, and RecipeMaterials sheets.",
        "- Product designNumber is the upsert key (non-deleted Products).",
        "- Recipes are always created as new versions; existing recipes are not overwritten.",
        "- Steps must reference valid DeviceType names from REF_DeviceTypes.",
        "- RecipeMaterials.rawMaterialId must match a RawMaterial id from REF_RawMaterials (column id).",
        "- dependsOnStepOrders must reference valid step orders within the same recipe."
      ],
      ko: [
        "- Products, Recipes, Steps, RecipeMaterials 시트를 각각 작성하세요.",
        "- 제품의 designNumber 컬럼은 업서트 키이며(삭제되지 않은 Products 기준), 고유해야 합니다.",
        "- 레시피는 항상 새 버전으로 생성되며, 기존 레시피는 덮어쓰지 않습니다.",
        "- Steps 시트의 deviceTypeName 값은 REF_DeviceTypes 시트의 유효한 장비 유형 이름을 참조해야 합니다.",
        "- RecipeMaterials 시트의 rawMaterialId 값은 REF_RawMaterials 시트의 id(원자재 MongoDB _id)와 일치해야 합니다.",
        "- dependsOnStepOrders 값은 동일한 레시피 내에서 존재하는 단계 번호(stepOrder)만 참조해야 합니다."
      ]
    }
  },
  dataValidation: {
    productDesignNumber: {
      en: "productDesignNumber must be a valid product design number.",
      ko: "productDesignNumber 값은 유효한 제품 디자인 번호여야 합니다."
    },
    recipeName: {
      en: "recipeName must be a valid recipe name.",
      ko: "recipeName 값은 유효한 레시피 이름여야 합니다."
    },
    estimatedDuration: {
      en: "estimatedDuration_min must be a number greater than or equal to 0.",
      ko: "estimatedDuration_min 값은 0 이상의 숫자여야 합니다."
    },
    deviceTypeName: {
      en: "deviceTypeName must be a valid device type name.",
      ko: "deviceTypeName 값은 유효한 장비 유형 이름여야 합니다."
    },
    rawMaterialId: {
      en: "rawMaterialId must be a valid RawMaterial id from REF_RawMaterials.",
      ko: "rawMaterialId 값은 REF_RawMaterials 시트의 유효한 원자재 id여야 합니다."
    },
    quantityRequired: {
      en: "quantityRequired must be a number greater than 0.",
      ko: "quantityRequired 값은 0 이상의 숫자여야 합니다."
    }
  }
};
const MAX_ROWS_PER_SHEET = 500;

export async function generateProductImportTemplate(
  lang: "en" | "ko" = "ko"
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  const now = new Date();
  workbook.creator = "Smart Factory";
  workbook.lastModifiedBy = "Smart Factory";
  workbook.created = now;
  workbook.modified = now;

  const deviceTypes = await DeviceType.find({
    isActive: { $ne: false }
  }).lean();
  const rawMaterials = await RawMaterial.find({})
    .populate("materialType", "code name")
    .lean();

  // Instructions
  const instructionsSheet = workbook.addWorksheet("Instructions");
  instructionsSheet.properties.tabColor = { argb: COLORS.NEUTRAL };
  createInstructionBox(
    instructionsSheet,
    1,
    1,
    40,
    8,
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

  // Products
  const productsSheet = workbook.addWorksheet("Products", {
    properties: { tabColor: { argb: "FFFFFF00" } }
  });
  productsSheet.columns = [
    { header: "designNumber", key: "designNumber", width: 22 },
    { header: "productName", key: "productName", width: 30 },
    { header: "customerName", key: "customerName", width: 25 },
    { header: "personInCharge", key: "personInCharge", width: 20 },
    { header: "department", key: "department", width: 20 },
    { header: "quantityUnit", key: "quantityUnit", width: 14 }
  ];
  styleHeaderRow(productsSheet, 1, productsSheet.columns.length);
  freezePanes(productsSheet);
  enableAutoFilter(productsSheet, 1, 1, productsSheet.columns.length);
  const productExampleRow = productsSheet.addRow({
    designNumber: "PRD01-01-001-00",
    productName: "Sample Product",
    customerName: "ACME Corp",
    personInCharge: "kim",
    department: "Production",
    quantityUnit: "EA"
  });
  productExampleRow.font = { italic: true, color: { argb: "FF808080" } };

  // Recipes
  const recipesSheet = workbook.addWorksheet("Recipes", {
    properties: { tabColor: { argb: "FFFFA500" } }
  });
  recipesSheet.columns = [
    { header: "recipeName", key: "recipeName", width: 30 },
    { header: "productDesignNumber", key: "productDesignNumber", width: 22 },
    { header: "description", key: "description", width: 30 },
    { header: "dwgNo", key: "dwgNo", width: 18 },
    { header: "unit", key: "unit", width: 10 },
    { header: "outsourcing", key: "outsourcing", width: 20 },
    { header: "remarks", key: "remarks", width: 30 }
  ];
  styleHeaderRow(recipesSheet, 1, recipesSheet.columns.length);
  freezePanes(recipesSheet);
  enableAutoFilter(recipesSheet, 1, 1, recipesSheet.columns.length);
  const recipeExampleRow = recipesSheet.addRow({
    recipeName: "Sample Recipe v1",
    productDesignNumber: "PRD01-01-001-00",
    description: "Example recipe for demo product",
    dwgNo: "DWG-001",
    unit: "EA",
    outsourcing: "",
    remarks: ""
  });
  recipeExampleRow.font = { italic: true, color: { argb: "FF808080" } };

  // Validate productDesignNumber
  await Promise.all(
    Array.from({ length: MAX_ROWS_PER_SHEET - 3 + 1 }, (_, row) => row + 3).map(
      async (row) => {
        const productDesignNumberCell = recipesSheet.getCell(`B${row}`);
        productDesignNumberCell.dataValidation = {
          type: "list",
          formulae: [`Products!$A$3:$A$${MAX_ROWS_PER_SHEET}`],
          allowBlank: false,
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.productDesignNumber[lang]
        };
      }
    )
  );

  // Steps
  const stepsSheet = workbook.addWorksheet("Steps", {
    properties: { tabColor: { argb: "FF87CEFA" } }
  });
  stepsSheet.columns = [
    { header: "recipeName", key: "recipeName", width: 30 },
    { header: "stepOrder", key: "stepOrder", width: 10 },
    { header: "stepName", key: "stepName", width: 25 },
    { header: "stepDescription", key: "stepDescription", width: 30 },
    {
      header: "estimatedDuration_min",
      key: "estimatedDuration_min",
      width: 20
    },
    { header: "deviceTypeName", key: "deviceTypeName", width: 25 },
    { header: "qualityChecks", key: "qualityChecks", width: 30 },
    { header: "dependsOnStepOrders", key: "dependsOnStepOrders", width: 20 }
  ];
  styleHeaderRow(stepsSheet, 1, stepsSheet.columns.length);
  freezePanes(stepsSheet);
  enableAutoFilter(stepsSheet, 1, 1, stepsSheet.columns.length);
  const stepsExampleRow = stepsSheet.addRow({
    recipeName: "Sample Recipe v1",
    stepOrder: 1,
    stepName: "Cutting",
    stepDescription: "Cut material to size",
    estimatedDuration_min: 30,
    deviceTypeName: deviceTypes[0]?.name ?? "Laser Cutter",
    qualityChecks: "dim check, flatness",
    dependsOnStepOrders: ""
  });
  stepsExampleRow.font = { italic: true, color: { argb: "FF808080" } };

  const list = deviceTypes.map((dt: any) => dt.name).join(",");
  // If you might ever have double quotes in names, escape them for Excel:
  const escapedList = list.replace(/"/g, '""');

  await Promise.all(
    Array.from({ length: 100 - 3 + 1 }, (_, row) => row + 3).map(
      async (row) => {
        // RecipeName validation (list of recipe names)
        const recipeNameCell = stepsSheet.getCell(`A${row}`);
        recipeNameCell.dataValidation = {
          type: "list",
          formulae: [`Recipes!$A$3:$A$100`],
          allowBlank: false,
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.recipeName[lang]
        };

        // estimatedDuration validation (>= 0)
        const estimatedDurationCell = stepsSheet.getCell(`E${row}`);
        estimatedDurationCell.dataValidation = {
          type: "whole",
          operator: "greaterThanOrEqual",
          formulae: [0],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.estimatedDuration[lang]
        };

        // deviceTypeName validation (list of device type names)
        const deviceTypeCell = stepsSheet.getCell(`F${row}`);
        deviceTypeCell.dataValidation = {
          type: "list",
          formulae: [`"${escapedList}"`], // double quotes only
          allowBlank: false,
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.deviceTypeName[lang]
        };
      }
    )
  );

  loggerService.debug("deviceTypes: " + `"${escapedList}"`);

  // REF_RawMaterials (created before RecipeMaterials so validation can reference this sheet)
  const refRawMaterialsSheet = workbook.addWorksheet("REF_RawMaterials", {
    properties: { tabColor: { argb: "FF98FB98" } }
  });
  refRawMaterialsSheet.columns = [
    { header: "id", key: "id", width: 28 },
    { header: "materialTypeCode", key: "materialTypeCode", width: 20 },
    { header: "materialTypeName", key: "materialTypeName", width: 30 },
    { header: "supplier", key: "supplier", width: 25 },
    { header: "unit", key: "unit", width: 10 },
    { header: "color", key: "color", width: 15 },
    { header: "dim_length", key: "dim_length", width: 15 },
    { header: "dim_width", key: "dim_width", width: 15 },
    { header: "dim_height", key: "dim_height", width: 15 },
    { header: "dim_unit", key: "dim_unit", width: 12 },
    { header: "weight_value", key: "weight_value", width: 18 },
    { header: "weight_unit", key: "weight_unit", width: 12 }
  ];
  styleHeaderRow(refRawMaterialsSheet, 1, refRawMaterialsSheet.columns.length);

  rawMaterials.forEach((rm: any) => {
    const mt = rm.materialType;
    const mtCode =
      mt && typeof mt === "object" && mt.code != null ? mt.code : "";
    const mtName =
      mt && typeof mt === "object" && mt.name != null ? mt.name : "";
    refRawMaterialsSheet.addRow({
      id: rm._id.toString(),
      materialTypeCode: mtCode,
      materialTypeName: mtName,
      supplier: rm.supplier ?? "",
      unit: rm.unit ?? "",
      color: rm.color ?? "",
      dim_length: rm.dimensions?.length ?? "",
      dim_width: rm.dimensions?.width ?? "",
      dim_height: rm.dimensions?.height ?? "",
      dim_unit: rm.dimensions?.unit ?? "",
      weight_value: rm.weight?.value ?? "",
      weight_unit: rm.weight?.unit ?? ""
    });
  });

  refRawMaterialsSheet.getColumn(1).hidden = true;
  await refRawMaterialsSheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true
  });

  // RecipeMaterials
  const recipeMaterialsSheet = workbook.addWorksheet("RecipeMaterials", {
    properties: { tabColor: { argb: "FF90EE90" } }
  });
  recipeMaterialsSheet.columns = [
    { header: "recipeName", key: "recipeName", width: 30 },
    { header: "rawMaterialId", key: "rawMaterialId", width: 28 },
    { header: "quantityRequired", key: "quantityRequired", width: 18 },
    { header: "spec_color", key: "spec_color", width: 15 },
    { header: "spec_dim_length", key: "spec_dim_length", width: 15 },
    { header: "spec_dim_width", key: "spec_dim_width", width: 15 },
    { header: "spec_dim_height", key: "spec_dim_height", width: 15 },
    { header: "spec_dim_unit", key: "spec_dim_unit", width: 12 },
    { header: "spec_weight_value", key: "spec_weight_value", width: 18 },
    { header: "spec_weight_unit", key: "spec_weight_unit", width: 12 }
  ];
  styleHeaderRow(recipeMaterialsSheet, 1, recipeMaterialsSheet.columns.length);
  freezePanes(recipeMaterialsSheet);
  enableAutoFilter(
    recipeMaterialsSheet,
    1,
    1,
    recipeMaterialsSheet.columns.length
  );
  const recipeMatExampleRow = recipeMaterialsSheet.addRow({
    recipeName: "Sample Recipe v1",
    rawMaterialId: rawMaterials[0]?._id?.toString() ?? "",
    quantityRequired: 2,
    spec_color: "",
    spec_dim_length: "",
    spec_dim_width: "",
    spec_dim_height: "",
    spec_dim_unit: "",
    spec_weight_value: "",
    spec_weight_unit: ""
  });
  recipeMatExampleRow.font = { italic: true, color: { argb: "FF808080" } };

  await Promise.all(
    Array.from({ length: 100 - 3 + 1 }, (_, row) => row + 3).map(
      async (row) => {
        // recipeName validation (list of recipe names)
        const recipeNameCell = recipeMaterialsSheet.getCell(`A${row}`);
        recipeNameCell.dataValidation = {
          type: "list",
          formulae: [`Recipes!$A$3:$A$100`],
          allowBlank: false,
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.recipeName[lang]
        };

        // rawMaterialId validation (ids from REF_RawMaterials column A)
        const rawMaterialIdCell = recipeMaterialsSheet.getCell(`B${row}`);
        rawMaterialIdCell.dataValidation = {
          type: "list",
          formulae: [`REF_RawMaterials!$A$3:$A$${MAX_ROWS_PER_SHEET}`],
          allowBlank: false,
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.rawMaterialId[lang]
        };

        // quantityRequired validation (> 0)
        const quantityRequiredCell = recipeMaterialsSheet.getCell(`C${row}`);
        quantityRequiredCell.dataValidation = {
          type: "whole",
          operator: "greaterThan",
          formulae: [0],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.quantityRequired[lang]
        };

        //
      }
    )
  );

  // REF_DeviceTypes
  const refDeviceTypesSheet = workbook.addWorksheet("REF_DeviceTypes", {
    properties: { tabColor: { argb: "FFADD8E6" } }
  });
  refDeviceTypesSheet.columns = [
    { header: "id", key: "id", width: 30 },
    { header: "name", key: "name", width: 30 },
    { header: "description", key: "description", width: 40 }
  ];
  styleHeaderRow(refDeviceTypesSheet, 1, refDeviceTypesSheet.columns.length);
  deviceTypes.forEach((dt: any) => {
    refDeviceTypesSheet.addRow({
      id: (dt as any)._id.toString(),
      name: dt.name,
      description: dt.description ?? ""
    });
  });
  refDeviceTypesSheet.getColumn(1).hidden = true;
  await refDeviceTypesSheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true
  });

  return workbook;
}

export async function parseProductImportWorkbook(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<ParsedProductData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const errors: ImportRowError[] = [];

  const productsSheet = workbook.getWorksheet("Products");
  const recipesSheet = workbook.getWorksheet("Recipes");
  const stepsSheet = workbook.getWorksheet("Steps");
  const recipeMaterialsSheet = workbook.getWorksheet("RecipeMaterials");
  const refDeviceTypesSheet = workbook.getWorksheet("REF_DeviceTypes");
  const refRawMaterialsSheet = workbook.getWorksheet("REF_RawMaterials");

  if (!productsSheet) {
    errors.push({
      sheet: "Products",
      row: 1,
      message: "Sheet 'Products' not found.",
      severity: "error"
    });
  }
  if (!recipesSheet) {
    errors.push({
      sheet: "Recipes",
      row: 1,
      message: "Sheet 'Recipes' not found.",
      severity: "error"
    });
  }
  if (!stepsSheet) {
    errors.push({
      sheet: "Steps",
      row: 1,
      message: "Sheet 'Steps' not found.",
      severity: "error"
    });
  }
  if (!recipeMaterialsSheet) {
    errors.push({
      sheet: "RecipeMaterials",
      row: 1,
      message: "Sheet 'RecipeMaterials' not found.",
      severity: "error"
    });
  }

  if (!productsSheet || !recipesSheet || !stepsSheet || !recipeMaterialsSheet) {
    return {
      products: [],
      recipes: [],
      steps: [],
      recipeMaterials: [],
      errors
    };
  }

  if (productsSheet.rowCount - 1 > MAX_ROWS_PER_SHEET) {
    errors.push({
      sheet: "Products",
      row: 0,
      message: `Too many rows. Maximum allowed is ${MAX_ROWS_PER_SHEET}.`,
      severity: "error"
    });
  }
  if (recipesSheet.rowCount - 1 > MAX_ROWS_PER_SHEET) {
    errors.push({
      sheet: "Recipes",
      row: 0,
      message: `Too many rows. Maximum allowed is ${MAX_ROWS_PER_SHEET}.`,
      severity: "error"
    });
  }
  if (stepsSheet.rowCount - 1 > MAX_ROWS_PER_SHEET) {
    errors.push({
      sheet: "Steps",
      row: 0,
      message: `Too many rows. Maximum allowed is ${MAX_ROWS_PER_SHEET}.`,
      severity: "error"
    });
  }
  if (recipeMaterialsSheet.rowCount - 1 > MAX_ROWS_PER_SHEET) {
    errors.push({
      sheet: "RecipeMaterials",
      row: 0,
      message: `Too many rows. Maximum allowed is ${MAX_ROWS_PER_SHEET}.`,
      severity: "error"
    });
  }

  const products: ParsedProduct[] = [];
  const recipes: ParsedRecipeRow[] = [];
  const steps: ParsedStepRow[] = [];
  const recipeMaterials: ParsedRecipeMaterialRow[] = [];

  const productHeaderMap = parseHeaderRow(productsSheet, 1);
  const recipeHeaderMap = parseHeaderRow(recipesSheet, 1);
  const stepsHeaderMap = parseHeaderRow(stepsSheet, 1);
  const recipeMatHeaderMap = parseHeaderRow(recipeMaterialsSheet, 1);

  // Products
  const designNumbersInFile = new Set<string>();
  for (let rowNumber = 3; rowNumber <= productsSheet.rowCount; rowNumber++) {
    const row = productsSheet.getRow(rowNumber);
    const designNumberIndex = productHeaderMap.get("designNumber");
    const productNameIndex = productHeaderMap.get("productName");

    const designNumber =
      designNumberIndex != null
        ? cellToString(row.getCell(designNumberIndex))
        : null;
    const productName =
      productNameIndex != null
        ? cellToString(row.getCell(productNameIndex))
        : null;

    if (!designNumber && !productName) {
      continue;
    }

    if (!designNumber) {
      errors.push({
        sheet: "Products",
        row: rowNumber,
        column: "designNumber",
        message: "designNumber is required.",
        severity: "error"
      });
      continue;
    }

    // Validate design number format: 00000-00-000-00 (5 chars - 2 digits - 3 digits - 2 digits)
    const DESIGN_NUMBER_REGEX = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}-[0-9]{2}$/;
    if (!DESIGN_NUMBER_REGEX.test(designNumber)) {
      errors.push({
        sheet: "Products",
        row: rowNumber,
        column: "designNumber",
        message: "designNumber must be a valid product design number.",
        severity: "error"
      });
      continue;
    }

    if (!productName) {
      errors.push({
        sheet: "Products",
        row: rowNumber,
        column: "productName",
        message: "productName is required.",
        severity: "error"
      });
    }

    if (designNumbersInFile.has(designNumber)) {
      errors.push({
        sheet: "Products",
        row: rowNumber,
        column: "designNumber",
        message: `designNumber '${designNumber}' must be unique within file.`,
        severity: "error"
      });
    } else {
      designNumbersInFile.add(designNumber);
    }

    const customerNameIndex = productHeaderMap.get("customerName");
    const personInChargeIndex = productHeaderMap.get("personInCharge");
    const departmentIndex = productHeaderMap.get("department");
    const quantityUnitIndex = productHeaderMap.get("quantityUnit");

    products.push({
      rowNumber,
      designNumber,
      productName: productName ?? "",
      customerName:
        customerNameIndex != null
          ? cellToString(row.getCell(customerNameIndex)) ?? undefined
          : undefined,
      personInCharge:
        personInChargeIndex != null
          ? cellToString(row.getCell(personInChargeIndex)) ?? undefined
          : undefined,
      department:
        departmentIndex != null
          ? cellToString(row.getCell(departmentIndex)) ?? undefined
          : undefined,
      quantityUnit:
        quantityUnitIndex != null
          ? cellToString(row.getCell(quantityUnitIndex)) ?? undefined
          : undefined
    });
  }

  // Recipes
  const recipeNamesInFile = new Set<string>();
  for (let rowNumber = 2; rowNumber <= recipesSheet.rowCount; rowNumber++) {
    const row = recipesSheet.getRow(rowNumber);
    const recipeNameIndex = recipeHeaderMap.get("recipeName");
    const productDesignNumberIndex = recipeHeaderMap.get("productDesignNumber");

    const recipeName =
      recipeNameIndex != null
        ? cellToString(row.getCell(recipeNameIndex))
        : null;
    const productDesignNumber =
      productDesignNumberIndex != null
        ? cellToString(row.getCell(productDesignNumberIndex))
        : null;

    if (!recipeName && !productDesignNumber) {
      continue;
    }

    if (!recipeName) {
      errors.push({
        sheet: "Recipes",
        row: rowNumber,
        column: "recipeName",
        message: "recipeName is required.",
        severity: "error"
      });
    }
    if (!productDesignNumber) {
      errors.push({
        sheet: "Recipes",
        row: rowNumber,
        column: "productDesignNumber",
        message: "productDesignNumber is required.",
        severity: "error"
      });
    }

    if (recipeName && recipeNamesInFile.has(recipeName)) {
      errors.push({
        sheet: "Recipes",
        row: rowNumber,
        column: "recipeName",
        message: `recipeName '${recipeName}' must be unique within file.`,
        severity: "error"
      });
    } else if (recipeName) {
      recipeNamesInFile.add(recipeName);
    }

    const descriptionIndex = recipeHeaderMap.get("description");
    const dwgNoIndex = recipeHeaderMap.get("dwgNo");
    const unitIndex = recipeHeaderMap.get("unit");
    const outsourcingIndex = recipeHeaderMap.get("outsourcing");
    const remarksIndex = recipeHeaderMap.get("remarks");

    recipes.push({
      rowNumber,
      recipeName: recipeName ?? "",
      productDesignNumber: productDesignNumber ?? "",
      description:
        descriptionIndex != null
          ? cellToString(row.getCell(descriptionIndex)) ?? undefined
          : undefined,
      dwgNo:
        dwgNoIndex != null
          ? cellToString(row.getCell(dwgNoIndex)) ?? undefined
          : undefined,
      unit:
        unitIndex != null
          ? cellToString(row.getCell(unitIndex)) ?? undefined
          : undefined,
      outsourcing:
        outsourcingIndex != null
          ? cellToString(row.getCell(outsourcingIndex)) ?? undefined
          : undefined,
      remarks:
        remarksIndex != null
          ? cellToString(row.getCell(remarksIndex)) ?? undefined
          : undefined
    });
  }

  // Steps
  const stepsByRecipeAndOrder = new Map<string, Set<number>>();
  const allDeviceTypeNames: string[] = [];
  for (let rowNumber = 2; rowNumber <= stepsSheet.rowCount; rowNumber++) {
    const row = stepsSheet.getRow(rowNumber);
    const recipeNameIndex = stepsHeaderMap.get("recipeName");
    const stepOrderIndex = stepsHeaderMap.get("stepOrder");
    const stepNameIndex = stepsHeaderMap.get("stepName");
    const estDurIndex = stepsHeaderMap.get("estimatedDuration_min");
    const deviceTypeNameIndex = stepsHeaderMap.get("deviceTypeName");
    const qualityChecksIndex = stepsHeaderMap.get("qualityChecks");
    const dependsIndex = stepsHeaderMap.get("dependsOnStepOrders");

    const recipeName =
      recipeNameIndex != null
        ? cellToString(row.getCell(recipeNameIndex))
        : null;
    const stepOrderRaw =
      stepOrderIndex != null ? cellToNumber(row.getCell(stepOrderIndex)) : null;
    const stepName =
      stepNameIndex != null ? cellToString(row.getCell(stepNameIndex)) : null;
    const estimatedDuration =
      estDurIndex != null ? cellToNumber(row.getCell(estDurIndex)) : null;
    const deviceTypeName =
      deviceTypeNameIndex != null
        ? cellToString(row.getCell(deviceTypeNameIndex))
        : null;

    if (
      !recipeName &&
      stepOrderRaw == null &&
      !stepName &&
      estimatedDuration == null &&
      !deviceTypeName
    ) {
      continue;
    }

    if (!recipeName) {
      errors.push({
        sheet: "Steps",
        row: rowNumber,
        column: "recipeName",
        message: "recipeName is required.",
        severity: "error"
      });
    }

    const stepOrder =
      stepOrderRaw != null ? Math.trunc(stepOrderRaw) : undefined;
    if (stepOrder == null || stepOrder <= 0) {
      errors.push({
        sheet: "Steps",
        row: rowNumber,
        column: "stepOrder",
        message: "stepOrder must be an integer >= 1.",
        severity: "error"
      });
    }

    if (!stepName) {
      errors.push({
        sheet: "Steps",
        row: rowNumber,
        column: "stepName",
        message: "stepName is required.",
        severity: "error"
      });
    }

    if (estimatedDuration == null || estimatedDuration < 0) {
      errors.push({
        sheet: "Steps",
        row: rowNumber,
        column: "estimatedDuration_min",
        message: "estimatedDuration_min must be a non-negative number.",
        severity: "error"
      });
    }

    if (!deviceTypeName) {
      errors.push({
        sheet: "Steps",
        row: rowNumber,
        column: "deviceTypeName",
        message: "deviceTypeName is required.",
        severity: "error"
      });
    } else {
      allDeviceTypeNames.push(deviceTypeName);
    }

    if (recipeName && stepOrder != null) {
      const key = recipeName;
      if (!stepsByRecipeAndOrder.has(key)) {
        stepsByRecipeAndOrder.set(key, new Set());
      }
      const existingOrders = stepsByRecipeAndOrder.get(key)!;
      if (existingOrders.has(stepOrder)) {
        errors.push({
          sheet: "Steps",
          row: rowNumber,
          column: "stepOrder",
          message: `Duplicate stepOrder '${stepOrder}' for recipe '${recipeName}'.`,
          severity: "error"
        });
      } else {
        existingOrders.add(stepOrder);
      }
    }

    const stepDescription =
      stepsHeaderMap.get("stepDescription") != null
        ? cellToString(
            row.getCell(stepsHeaderMap.get("stepDescription") as number)
          ) ?? undefined
        : undefined;

    const qualityChecksRaw =
      qualityChecksIndex != null
        ? cellToString(row.getCell(qualityChecksIndex))
        : null;
    const qualityChecks = qualityChecksRaw
      ? qualityChecksRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const dependsRaw =
      dependsIndex != null ? cellToString(row.getCell(dependsIndex)) : null;
    const dependsOnStepOrders = dependsRaw
      ? dependsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => Number(s))
          .filter((n) => !Number.isNaN(n))
      : [];

    steps.push({
      rowNumber,
      recipeName: recipeName ?? "",
      stepOrder: stepOrder ?? 0,
      stepName: stepName ?? "",
      stepDescription,
      estimatedDurationMin: estimatedDuration ?? 0,
      deviceTypeName: deviceTypeName ?? "",
      qualityChecks,
      dependsOnStepOrders
    });
  }

  // RecipeMaterials
  const allMaterialIds: string[] = [];
  const allMaterialNames: string[] = [];
  for (
    let rowNumber = 2;
    rowNumber <= recipeMaterialsSheet.rowCount;
    rowNumber++
  ) {
    const row = recipeMaterialsSheet.getRow(rowNumber);
    const recipeNameIndex = recipeMatHeaderMap.get("recipeName");
    const rawMaterialIdIndex = recipeMatHeaderMap.get("rawMaterialId");
    const materialNameIndex = recipeMatHeaderMap.get("materialName");
    const quantityIndex = recipeMatHeaderMap.get("quantityRequired");

    const recipeName =
      recipeNameIndex != null
        ? cellToString(row.getCell(recipeNameIndex))
        : null;
    const rawMaterialId =
      rawMaterialIdIndex != null
        ? cellToString(row.getCell(rawMaterialIdIndex))
        : null;
    const materialName =
      materialNameIndex != null
        ? cellToString(row.getCell(materialNameIndex))
        : null;
    const quantity =
      quantityIndex != null ? cellToNumber(row.getCell(quantityIndex)) : null;

    const idTrimmed = rawMaterialId?.trim() ?? "";
    const nameTrimmed = materialName?.trim() ?? "";
    const hasId = idTrimmed.length > 0;
    const hasLegacyName = nameTrimmed.length > 0;

    if (!recipeName && !hasId && !hasLegacyName && quantity == null) {
      continue;
    }

    if (!recipeName) {
      errors.push({
        sheet: "RecipeMaterials",
        row: rowNumber,
        column: "recipeName",
        message: "recipeName is required.",
        severity: "error"
      });
    }

    if (!hasId && !hasLegacyName) {
      errors.push({
        sheet: "RecipeMaterials",
        row: rowNumber,
        column: "rawMaterialId",
        message:
          "rawMaterialId is required (or legacy column materialName for older templates).",
        severity: "error"
      });
    } else if (hasId) {
      if (!mongoose.Types.ObjectId.isValid(idTrimmed)) {
        errors.push({
          sheet: "RecipeMaterials",
          row: rowNumber,
          column: "rawMaterialId",
          message: `rawMaterialId '${idTrimmed}' is not a valid ObjectId.`,
          severity: "error"
        });
      } else {
        allMaterialIds.push(idTrimmed);
      }
    } else if (hasLegacyName) {
      allMaterialNames.push(nameTrimmed);
    }

    if (quantity == null || quantity <= 0) {
      errors.push({
        sheet: "RecipeMaterials",
        row: rowNumber,
        column: "quantityRequired",
        message: "quantityRequired must be a number greater than 0.",
        severity: "error"
      });
    }

    const spec_colorIndex = recipeMatHeaderMap.get("spec_color");
    const spec_dim_lengthIndex = recipeMatHeaderMap.get("spec_dim_length");
    const spec_dim_widthIndex = recipeMatHeaderMap.get("spec_dim_width");
    const spec_dim_heightIndex = recipeMatHeaderMap.get("spec_dim_height");
    const spec_dim_unitIndex = recipeMatHeaderMap.get("spec_dim_unit");
    const spec_weight_valueIndex = recipeMatHeaderMap.get("spec_weight_value");
    const spec_weight_unitIndex = recipeMatHeaderMap.get("spec_weight_unit");

    const spec_color =
      spec_colorIndex != null
        ? cellToString(row.getCell(spec_colorIndex)) ?? undefined
        : undefined;
    const spec_dim_length =
      spec_dim_lengthIndex != null
        ? cellToNumber(row.getCell(spec_dim_lengthIndex)) ?? undefined
        : undefined;
    const spec_dim_width =
      spec_dim_widthIndex != null
        ? cellToNumber(row.getCell(spec_dim_widthIndex)) ?? undefined
        : undefined;
    const spec_dim_height =
      spec_dim_heightIndex != null
        ? cellToNumber(row.getCell(spec_dim_heightIndex)) ?? undefined
        : undefined;
    const spec_dim_unit =
      spec_dim_unitIndex != null
        ? cellToString(row.getCell(spec_dim_unitIndex)) ?? undefined
        : undefined;
    const spec_weight_value =
      spec_weight_valueIndex != null
        ? cellToNumber(row.getCell(spec_weight_valueIndex)) ?? undefined
        : undefined;
    const spec_weight_unit =
      spec_weight_unitIndex != null
        ? cellToString(row.getCell(spec_weight_unitIndex)) ?? undefined
        : undefined;

    recipeMaterials.push({
      rowNumber,
      recipeName: recipeName ?? "",
      rawMaterialId: idTrimmed,
      materialName: hasLegacyName ? nameTrimmed : undefined,
      quantityRequired: quantity ?? 0,
      spec: {
        color: spec_color,
        dim_length: spec_dim_length,
        dim_width: spec_dim_width,
        dim_height: spec_dim_height,
        dim_unit: spec_dim_unit,
        weight_value: spec_weight_value,
        weight_unit: spec_weight_unit
      }
    });
  }

  // Resolve DeviceTypes and RawMaterials from DB and REF sheets
  const deviceTypeNamesFromRef = new Set<string>();
  if (refDeviceTypesSheet) {
    const headerMap = parseHeaderRow(refDeviceTypesSheet, 1);
    const nameCol = headerMap.get("name");
    if (nameCol != null) {
      for (
        let rowNumber = 2;
        rowNumber <= refDeviceTypesSheet.rowCount;
        rowNumber++
      ) {
        const row = refDeviceTypesSheet.getRow(rowNumber);
        const name = cellToString(row.getCell(nameCol));
        if (name) deviceTypeNamesFromRef.add(name);
      }
    }
  }

  const dbDeviceTypes = await DeviceType.find({
    name: { $in: allDeviceTypeNames }
  }).lean();
  const dbDeviceTypeNames = new Set<string>(
    dbDeviceTypes.map((dt: any) => dt.name)
  );

  steps.forEach((step) => {
    if (
      step.deviceTypeName &&
      !deviceTypeNamesFromRef.has(step.deviceTypeName) &&
      !dbDeviceTypeNames.has(step.deviceTypeName)
    ) {
      errors.push({
        sheet: "Steps",
        row: step.rowNumber,
        column: "deviceTypeName",
        message: `Device type '${step.deviceTypeName}' does not exist.`,
        severity: "error"
      });
    }
  });

  const materialIdsFromRef = new Set<string>();
  const materialNamesFromRef = new Set<string>();
  if (refRawMaterialsSheet) {
    const headerMap = parseHeaderRow(refRawMaterialsSheet, 1);
    const idCol = headerMap.get("id");
    if (idCol != null) {
      for (
        let rowNumber = 2;
        rowNumber <= refRawMaterialsSheet.rowCount;
        rowNumber++
      ) {
        const row = refRawMaterialsSheet.getRow(rowNumber);
        const id = cellToString(row.getCell(idCol));
        if (id) materialIdsFromRef.add(id.trim());
      }
    }
    const materialNameCol = headerMap.get("materialName");
    if (materialNameCol != null) {
      for (
        let rowNumber = 2;
        rowNumber <= refRawMaterialsSheet.rowCount;
        rowNumber++
      ) {
        const row = refRawMaterialsSheet.getRow(rowNumber);
        const name = cellToString(row.getCell(materialNameCol));
        if (name) materialNamesFromRef.add(name);
      }
    }
  }

  const idConditions: Array<
    | { _id: { $in: mongoose.Types.ObjectId[] } }
    | { name: { $in: string[] } }
  > = [];
  if (allMaterialIds.length > 0) {
    const oidList = allMaterialIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (oidList.length > 0) {
      idConditions.push({ _id: { $in: oidList } });
    }
  }
  if (allMaterialNames.length > 0) {
    idConditions.push({ name: { $in: allMaterialNames } });
  }

  const dbRawMaterialsForImport =
    idConditions.length > 0
      ? await RawMaterial.find({ $or: idConditions }).lean()
      : [];

  const dbMaterialIds = new Set(
    dbRawMaterialsForImport.map((rm) => (rm._id as mongoose.Types.ObjectId).toString())
  );
  const dbMaterialNames = new Set<string>(
    dbRawMaterialsForImport
      .map((rm) => (rm as { name?: string }).name)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
  );

  recipeMaterials.forEach((rm) => {
    if (rm.rawMaterialId) {
      if (
        !materialIdsFromRef.has(rm.rawMaterialId) &&
        !dbMaterialIds.has(rm.rawMaterialId)
      ) {
        errors.push({
          sheet: "RecipeMaterials",
          row: rm.rowNumber,
          column: "rawMaterialId",
          message: `Raw material id '${rm.rawMaterialId}' does not exist in REF_RawMaterials or the database.`,
          severity: "error"
        });
      }
    } else if (rm.materialName) {
      if (
        !materialNamesFromRef.has(rm.materialName) &&
        !dbMaterialNames.has(rm.materialName)
      ) {
        errors.push({
          sheet: "RecipeMaterials",
          row: rm.rowNumber,
          column: "materialName",
          message: `Material '${rm.materialName}' does not exist.`,
          severity: "error"
        });
      }
    }
  });

  // Validate foreign keys: Recipes.productDesignNumber
  const designNumbersInDbProducts = await Product.find(
    { designNumber: { $in: recipes.map((r) => r.productDesignNumber) } },
    { designNumber: 1, deletedAt: 1 }
  ).lean();
  const validDesignNumbersInDb = new Set<string>(
    designNumbersInDbProducts
      .filter((p: any) => !p.deletedAt)
      .map((p: any) => p.designNumber)
  );

  recipes.forEach((r) => {
    const designNumber = r.productDesignNumber;
    if (
      designNumber &&
      !designNumbersInFile.has(designNumber) &&
      !validDesignNumbersInDb.has(designNumber)
    ) {
      errors.push({
        sheet: "Recipes",
        row: r.rowNumber,
        column: "productDesignNumber",
        message: `Product with designNumber '${designNumber}' was not found in the Products sheet or in the database.`,
        severity: "error"
      });
    }
  });

  // Validate Steps.recipeName foreign key
  const recipeNamesSet = new Set(recipes.map((r) => r.recipeName));
  steps.forEach((s) => {
    if (s.recipeName && !recipeNamesSet.has(s.recipeName)) {
      errors.push({
        sheet: "Steps",
        row: s.rowNumber,
        column: "recipeName",
        message: `recipeName '${s.recipeName}' not found in Recipes sheet.`,
        severity: "error"
      });
    }
  });

  // Validate RecipeMaterials.recipeName foreign key
  recipeMaterials.forEach((rm) => {
    if (rm.recipeName && !recipeNamesSet.has(rm.recipeName)) {
      errors.push({
        sheet: "RecipeMaterials",
        row: rm.rowNumber,
        column: "recipeName",
        message: `recipeName '${rm.recipeName}' not found in Recipes sheet.`,
        severity: "error"
      });
    }
  });

  // Validate dependsOnStepOrders for each recipe
  const stepOrdersByRecipe = new Map<string, Set<number>>();
  steps.forEach((s) => {
    if (!stepOrdersByRecipe.has(s.recipeName)) {
      stepOrdersByRecipe.set(s.recipeName, new Set());
    }
    stepOrdersByRecipe.get(s.recipeName)!.add(s.stepOrder);
  });

  steps.forEach((s) => {
    const set = stepOrdersByRecipe.get(s.recipeName) || new Set<number>();
    s.dependsOnStepOrders.forEach((dep) => {
      if (!set.has(dep)) {
        errors.push({
          sheet: "Steps",
          row: s.rowNumber,
          column: "dependsOnStepOrders",
          message: `Step order '${dep}' referenced in dependsOnStepOrders does not exist in recipe '${s.recipeName}'.`,
          severity: "error"
        });
      }
    });
  });

  return {
    products,
    recipes,
    steps,
    recipeMaterials,
    errors
  };
}
