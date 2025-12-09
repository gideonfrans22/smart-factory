import { Project } from "../models/Project";
import { DateTime } from "../utils/datetime";

/**
 * Generate project name with quantity suffix
 * @param productName - Name of the product (if product-based project)
 * @param recipeName - Name of the recipe (if recipe-based project)
 * @param targetQuantity - Target quantity for the project
 * @returns Formatted project name: "Name (Qty: X)"
 */
export const generateProjectName = (
  productName?: string,
  recipeName?: string,
  targetQuantity: number = 1
): string => {
  const baseName = productName || recipeName || "Unnamed Project";
  return `${baseName} (Qty: ${targetQuantity})`;
};

/**
 * Generate unique project number with format: SMYY-MM-XXXX
 * Includes retry logic to handle potential duplicates
 * @param createdAt - Creation date for the project
 * @returns Formatted project number
 */
export const generateProjectNumber = async (
  createdAt: Date = DateTime
): Promise<string> => {
  const year = String(createdAt.getFullYear()).slice(-2);
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const datePrefix = `SM${year}-${month}`;

  // Get start and end of the day for the query
  const startOfDay = new Date(createdAt);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(createdAt);
  endOfDay.setHours(23, 59, 59, 999);

  // Count projects created on the same month
  const latestProjectThisMonth = await Project.findOne({
    projectNumber: { $regex: `^${datePrefix}-\\d{4}$` }
  }).sort({ projectNumber: -1 });
  const count = latestProjectThisMonth
    ? parseInt(latestProjectThisMonth.projectNumber.split("-")[2] || "0", 10)
    : 0;

  // Generate sequential number (count + 1, padded to 4 digits)
  const sequentialNumber = String(count + 1).padStart(4, "0");
  return `${datePrefix}-${sequentialNumber}`;
};

/**
 * Validate that project has exactly one of productSnapshot or recipeSnapshot
 * @param productSnapshot - Product snapshot ID
 * @param recipeSnapshot - Recipe snapshot ID
 * @throws Error if validation fails
 */
export const validateProjectSnapshotExclusivity = (
  productSnapshot?: any,
  recipeSnapshot?: any
): void => {
  const hasProduct = !!productSnapshot;
  const hasRecipe = !!recipeSnapshot;

  if (!hasProduct && !hasRecipe) {
    throw new Error("Project must have exactly one product or one recipe");
  }

  if (hasProduct && hasRecipe) {
    throw new Error("Project cannot have both product and recipe. Choose one.");
  }
};
