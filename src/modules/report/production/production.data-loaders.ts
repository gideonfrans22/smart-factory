/**
 * Production Rate Report Data Aggregation Service
 * Handles all data queries and calculations for production efficiency reports
 */

import { Project } from "@modules/project";
import { RecipeSnapshot } from "@modules/recipe";
import { Task } from "@modules/task";
import { DateRangeFilter } from "../helpers/adjustDateRangeForPeriod";

/**
 * Interface for Overall KPIs
 */
export interface OverallKPIs {
  totalProductProduction: number; // Count of unique products with projects
  totalPartProduction: number; // Count of completed recipe executions (parts)
  overallDeliveryComplianceRate: number; // Percentage
  totalWorkers: number; // Count of unique workers
}

/**
 * Aggregate Overall KPIs for the productivity report
 */
export async function aggregateOverallKPIs(
  dateRange: DateRangeFilter
): Promise<OverallKPIs> {
  const { startDate, endDate } = dateRange;

  // Get unique products with projects in date range
  const uniqueProducts = await Project.distinct("product", {
    product: { $exists: true, $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  });

  // Count completed recipe executions (parts) - tasks that are last step in recipe and completed
  const completedParts = await Task.countDocuments({
    status: "COMPLETED",
    isLastStepInRecipe: true,
    completedAt: { $gte: startDate, $lte: endDate }
  });

  // Calculate delivery compliance rate
  const totalProjects = await Project.countDocuments({
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  });

  const onTimeProjects = await Project.countDocuments({
    $and: [
      {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      },
      {
        $or: [
          // Completed on time
          {
            status: "COMPLETED",
            deadline: { $exists: true, $ne: null },
            endDate: { $exists: true, $ne: null },
            $expr: { $lte: ["$endDate", "$deadline"] }
          },
          // Active and not past deadline
          {
            status: { $in: ["ACTIVE", "ON_HOLD", "PLANNING"] },
            $or: [
              { deadline: { $exists: false } },
              { deadline: null },
              { deadline: { $gte: endDate } }
            ]
          }
        ]
      }
    ]
  });

  const deliveryComplianceRate =
    totalProjects > 0 ? (onTimeProjects / totalProjects) * 100 : 0;

  // Count unique workers who completed tasks
  const uniqueWorkers = await Task.distinct("workerId", {
    status: "COMPLETED",
    workerId: { $exists: true, $ne: null },
    completedAt: { $gte: startDate, $lte: endDate }
  });

  return {
    totalProductProduction: uniqueProducts.length,
    totalPartProduction: completedParts,
    overallDeliveryComplianceRate:
      Math.round(deliveryComplianceRate * 100) / 100,
    totalWorkers: uniqueWorkers.length
  };
}

/**
 * Interface for Product Status Data
 */
export interface ProductStatusData {
  product: any; // IProduct
  projects: Array<{
    project: any; // IProject
    instructionNo: string;
    designNumber: string;
    customerName: string;
    personInCharge: string;
    department: string;
    orderDate: Date | null;
    deliveryDate: Date | null;
    quantity: number;
    productionQuantity: number;
    remainingQuantity: number;
    completionRate: number;
    workTime: number; // in minutes
    deliveryDelays: number;
    deliveryComplianceRate: number;
  }>;
  parts: Array<{
    recipe: any; // IRecipe
    dwgNo: string;
    partName: string;
    quantity: number;
    productionQuantity: number;
    remainingQuantity: number;
    completionRate: number;
    totalWorkTime: number; // in minutes
    steps: Array<{
      stepId: string;
      stepName: string;
      deviceTypeName: string;
      workDetails: Array<{
        worker: any; // IUser
        workQuantity: number;
        workTime: number; // in minutes
      }>;
    }>;
  }>;
}

/**
 * Aggregate Product Status Data grouped by product
 */
export async function aggregateProductStatusData(
  dateRange: DateRangeFilter
): Promise<ProductStatusData[]> {
  const { startDate, endDate } = dateRange;

  // Get all projects with products in date range
  const projects = await Project.find({
    product: { $exists: true, $ne: null },
    productSnapshot: { $exists: true, $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("product")
    .populate("productSnapshot")
    .lean();

  // Get all tasks for these projects
  const projectIds = projects.map((p) => p._id);
  const tasks = await Task.find({
    projectId: { $in: projectIds },
    status: "COMPLETED"
  })
    .populate({ path: "workerId", options: { includeDeleted: true } })
    .populate("recipeSnapshotId")
    .lean();

  // Group projects by product
  const productMap = new Map<string, ProductStatusData>();

  for (const project of projects) {
    const productSnapshotId = (project.productSnapshot as any)?._id;
    if (!productSnapshotId) continue;

    const productSnapshot = project.productSnapshot as any;

    if (!productMap.has(productSnapshotId)) {
      productMap.set(productSnapshotId, {
        product: productSnapshot,
        projects: [],
        parts: []
      });
    }

    const productSnapshotData = productMap.get(productSnapshotId)!;

    // Calculate work time for this project (sum of task durations)
    const projectTasks = tasks.filter(
      (t) => t.projectId?.toString() === project._id.toString()
    );
    const workTime = projectTasks.reduce(
      (sum, t) => sum + (t.actualDuration || 0),
      0
    );

    // Check if project is delayed
    let deliveryDelays = 0;
    if (project.deadline && project.endDate) {
      if (new Date(project.endDate) > new Date(project.deadline)) {
        deliveryDelays = 1;
      }
    } else if (project.deadline && new Date(project.deadline) < endDate) {
      if (project.status !== "COMPLETED") {
        deliveryDelays = 1;
      }
    }

    // Calculate delivery compliance rate for this project
    const deliveryComplianceRate =
      deliveryDelays === 0 && project.deadline
        ? 100
        : deliveryDelays > 0
        ? 0
        : 100;

    const remainingQuantity = project.targetQuantity - project.producedQuantity;
    const completionRate =
      project.targetQuantity > 0
        ? (project.producedQuantity / project.targetQuantity) * 100
        : 0;

    productSnapshotData.projects.push({
      project: project,
      instructionNo: project.projectNumber || "",
      designNumber: (project.productSnapshot as any)?.productNumber || "",
      customerName: (project.productSnapshot as any)?.customerName || "",
      personInCharge: (project.productSnapshot as any)?.personInCharge || "",
      department: (project.productSnapshot as any)?.department || "",
      orderDate: project.startDate || project.createdAt || null,
      deliveryDate: project.deadline || null,
      quantity: project.targetQuantity,
      productionQuantity: project.producedQuantity,
      remainingQuantity: remainingQuantity,
      completionRate: Math.round(completionRate * 100) / 100,
      workTime: workTime,
      deliveryDelays: deliveryDelays,
      deliveryComplianceRate: deliveryComplianceRate
    });
  }

  // For each product, get recipes and aggregate part details
  for (const [productSnapshotId, productSnapshotData] of productMap.entries()) {
    const product = productSnapshotData.product;
    if (!product.recipes || product.recipes.length === 0) continue;

    // Get all recipe snapshots for this product
    const recipeSnapshotIds = product.recipes.map(
      (r: any) => r.recipeSnapshotId
    );
    const recipeSnapshots = await RecipeSnapshot.find({
      _id: { $in: recipeSnapshotIds }
    })
      .populate("steps.deviceTypeId", "name")
      .lean();

    // Get all projects for this product to calculate part quantities
    const productProjects = productSnapshotData.projects;

    for (const recipeRef of product.recipes) {
      const recipeSnapshot = recipeSnapshots.find(
        (r) => r._id.toString() === recipeRef.recipeSnapshotId.toString()
      );
      if (!recipeSnapshot) continue;

      // Calculate total quantity for this part across all projects
      const totalQuantity = productProjects.reduce(
        (sum, p) => sum + p.quantity * (recipeRef.quantity || 1),
        0
      );

      // Get tasks for this recipe across all projects
      const recipeTasks = tasks.filter((t) => {
        const taskRecipeSnapId = t.recipeSnapshotId as any;
        const taskProductSnapId = t.productSnapshotId as any;
        if (!taskRecipeSnapId || !taskProductSnapId) return false;
        return (
          taskRecipeSnapId._id.toString() ===
            recipeRef.recipeSnapshotId.toString() &&
          taskProductSnapId._id.toString() === productSnapshotId.toString()
        );
      });

      // Calculate production quantity (completed recipe executions)
      const productionQuantity = recipeTasks.filter(
        (t) => t.isLastStepInRecipe
      ).length;

      const remainingQuantity = totalQuantity - productionQuantity;
      const completionRate =
        totalQuantity > 0 ? (productionQuantity / totalQuantity) * 100 : 0;

      // Calculate total work time
      const totalWorkTime = recipeTasks.reduce(
        (sum, t) => sum + (t.actualDuration || 0),
        0
      );

      // Group work details by step
      const steps = recipeSnapshot.steps;
      const stepMap = new Map<
        string,
        {
          stepId: string;
          stepName: string;
          deviceTypeName: string;
          workDetails: Map<
            string,
            {
              worker: any; // IUser
              workQuantity: number;
              workTime: number; // in minutes
            }
          >;
        }
      >();
      steps.forEach((s) => {
        stepMap.set(s._id.toString(), {
          stepId: s._id.toString(),
          stepName: s.name,
          deviceTypeName: (s.deviceTypeId as any).name || "",
          workDetails: new Map()
        });
      });

      for (const task of recipeTasks) {
        const workerId = task.workerId?._id.toString();
        const stepId = task.recipeStepId.toString();
        const stepData = stepMap.get(stepId)!;
        if (!workerId || !stepData) continue;

        if (!stepData.workDetails.has(workerId)) {
          stepData.workDetails.set(workerId, {
            worker: (task.workerId as any)?.name || workerId || "",
            workQuantity: 0,
            workTime: 0
          });
        }

        const workerData = stepData.workDetails.get(workerId)!;
        workerData.workQuantity++;
        workerData.workTime += task.actualDuration || 0;
      }

      productSnapshotData.parts.push({
        recipe: recipeSnapshot,
        dwgNo: recipeSnapshot.dwgNo || "",
        partName: recipeSnapshot.name || "",
        quantity: totalQuantity,
        productionQuantity: productionQuantity,
        remainingQuantity: remainingQuantity,
        completionRate: Math.round(completionRate * 100) / 100,
        totalWorkTime: totalWorkTime,
        steps: Array.from(stepMap.values()).map((s) => ({
          stepId: s.stepId,
          stepName: s.stepName,
          deviceTypeName: s.deviceTypeName,
          workDetails: Array.from(s.workDetails.values())
        }))
      });
    }
  }

  return Array.from(productMap.values());
}
