import ExcelJS from "exceljs";
import { DeviceType } from "../models/DeviceType";
import { Product } from "../models/Product";
import { RawMaterial } from "../models/RawMaterial";
import { ImportRowError } from "@shared/types";
import { cellToNumber, cellToString, parseHeaderRow } from "@shared/utils";
import {
  COLORS,
  createInstructionBox,
  enableAutoFilter,
  freezePanes,
  styleHeaderRow
} from "./excelFormatService";
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
  materialName: string;
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
        "- RecipeMaterials must reference valid RawMaterial names from REF_RawMaterials.",
        "- dependsOnStepOrders must reference valid step orders within the same recipe."
      ],
      ko: [
        "- Products, Recipes, Steps, RecipeMaterials 시트를 각각 작성하세요.",
        "- 제품의 designNumber 컬럼은 업서트 키이며(삭제되지 않은 Products 기준), 고유해야 합니다.",
        "- 레시피는 항상 새 버전으로 생성되며, 기존 레시피는 덮어쓰지 않습니다.",
        "- Steps 시트의 deviceTypeName 값은 REF_DeviceTypes 시트의 유효한 장비 유형 이름을 참조해야 합니다.",
        "- RecipeMaterials 시트의 materialName 값은 REF_RawMaterials 시트의 유효한 원자재 이름을 참조해야 합니다.",
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
    materialName: {
      en: "materialName must be a valid raw material name.",
      ko: "materialName 값은 유효한 원자재 이름여야 합니다."
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
  const rawMaterials = await RawMaterial.find({}).lean();

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

  const list = deviceTypes.map((dt) => dt.name).join(",");
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

  // RecipeMaterials
  const recipeMaterialsSheet = workbook.addWorksheet("RecipeMaterials", {
    properties: { tabColor: { argb: "FF90EE90" } }
  });
  recipeMaterialsSheet.columns = [
    { header: "recipeName", key: "recipeName", width: 30 },
    { header: "materialName", key: "materialName", width: 30 },
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
    materialName: rawMaterials[0]?.name ?? "Aluminum Sheet",
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

  const rawMaterialsList = rawMaterials.map((rm) => rm.name).join(",");
  const escapedRawMaterialsList = rawMaterialsList.replace(/"/g, '""');
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

        // materialName validation (list of raw material names)
        const materialNameCell = recipeMaterialsSheet.getCell(`B${row}`);
        materialNameCell.dataValidation = {
          type: "list",
          formulae: [`"${escapedRawMaterialsList}"`],
          allowBlank: false,
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid value",
          error: TRANSLATIONS.dataValidation.materialName[lang]
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
  deviceTypes.forEach((dt) => {
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

  // REF_RawMaterials
  const refRawMaterialsSheet = workbook.addWorksheet("REF_RawMaterials", {
    properties: { tabColor: { argb: "FF98FB98" } }
  });
  refRawMaterialsSheet.columns = [
    { header: "materialName", key: "materialName", width: 30 },
    { header: "materialCode", key: "materialCode", width: 20 },
    { header: "supplier", key: "supplier", width: 25 },
    { header: "unit", key: "unit", width: 10 },
    { header: "spec_index", key: "spec_index", width: 10 },
    { header: "spec_color", key: "spec_color", width: 15 },
    { header: "spec_dim_length", key: "spec_dim_length", width: 15 },
    { header: "spec_dim_width", key: "spec_dim_width", width: 15 },
    { header: "spec_dim_height", key: "spec_dim_height", width: 15 },
    { header: "spec_dim_unit", key: "spec_dim_unit", width: 12 },
    { header: "spec_weight_value", key: "spec_weight_value", width: 18 },
    { header: "spec_weight_unit", key: "spec_weight_unit", width: 12 }
  ];
  styleHeaderRow(refRawMaterialsSheet, 1, refRawMaterialsSheet.columns.length);

  rawMaterials.forEach((rm) => {
    const specs =
      rm.specifications && rm.specifications.length
        ? rm.specifications
        : [null];
    specs.forEach((spec: any, index: number) => {
      refRawMaterialsSheet.addRow({
        materialName: (rm as any).name,
        materialCode: rm.materialCode,
        supplier: rm.supplier ?? "",
        unit: rm.unit ?? "",
        spec_index: index + 1,
        spec_color: spec?.color ?? "",
        spec_dim_length: spec?.dimensions?.length ?? "",
        spec_dim_width: spec?.dimensions?.width ?? "",
        spec_dim_height: spec?.dimensions?.height ?? "",
        spec_dim_unit: spec?.dimensions?.unit ?? "",
        spec_weight_value: spec?.weight?.value ?? "",
        spec_weight_unit: spec?.weight?.unit ?? ""
      });
    });
  });

  await refRawMaterialsSheet.protect("", {
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
  const allMaterialNames: string[] = [];
  for (
    let rowNumber = 2;
    rowNumber <= recipeMaterialsSheet.rowCount;
    rowNumber++
  ) {
    const row = recipeMaterialsSheet.getRow(rowNumber);
    const recipeNameIndex = recipeMatHeaderMap.get("recipeName");
    const materialNameIndex = recipeMatHeaderMap.get("materialName");
    const quantityIndex = recipeMatHeaderMap.get("quantityRequired");

    const recipeName =
      recipeNameIndex != null
        ? cellToString(row.getCell(recipeNameIndex))
        : null;
    const materialName =
      materialNameIndex != null
        ? cellToString(row.getCell(materialNameIndex))
        : null;
    const quantity =
      quantityIndex != null ? cellToNumber(row.getCell(quantityIndex)) : null;

    if (!recipeName && !materialName && quantity == null) {
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

    if (!materialName) {
      errors.push({
        sheet: "RecipeMaterials",
        row: rowNumber,
        column: "materialName",
        message: "materialName is required.",
        severity: "error"
      });
    } else {
      allMaterialNames.push(materialName);
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
      materialName: materialName ?? "",
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
  const dbDeviceTypeNames = new Set<string>(dbDeviceTypes.map((dt) => dt.name));

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

  const materialNamesFromRef = new Set<string>();
  if (refRawMaterialsSheet) {
    const headerMap = parseHeaderRow(refRawMaterialsSheet, 1);
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

  const dbRawMaterialsForImport = await RawMaterial.find({
    name: { $in: allMaterialNames }
  }).lean();
  const dbMaterialNames = new Set<string>(
    dbRawMaterialsForImport.map((rm) => (rm as any).name)
  );

  recipeMaterials.forEach((rm) => {
    if (
      rm.materialName &&
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
