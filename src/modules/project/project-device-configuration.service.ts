import { Device } from "@modules/device";
import { DeviceType } from "@modules/device-type";
import { Product } from "@modules/product";
import { Recipe } from "@modules/recipe";
import mongoose from "mongoose";
import { Project } from "./project.model";
import {
  IProjectDeviceConfiguration,
  ProjectDeviceConfiguration
} from "./project-device-configuration.model";
import type { DeviceConfigurationByDeviceType } from "./project-device-configuration.types";
import { DeviceConfigurationErrorCode } from "./project-device-configuration.types";
import { ProjectStatus } from "./project.types";

/** API wire format for `byDeviceType` (ObjectId hex strings). */
export function serializeDeviceConfigurationByDeviceType(
  map:
    | Map<string, mongoose.Types.ObjectId[]>
    | Record<string, mongoose.Types.ObjectId[]>
    | undefined
    | null
): DeviceConfigurationByDeviceType {
  if (map == null) {
    return {};
  }
  if (map instanceof Map) {
    const out: DeviceConfigurationByDeviceType = {};
    for (const [k, v] of map.entries()) {
      out[k] = (v || []).map((id) => id.toString());
    }
    return out;
  }
  const out: DeviceConfigurationByDeviceType = {};
  for (const [k, v] of Object.entries(map)) {
    if (Array.isArray(v)) {
      out[k] = v.map((id) =>
        typeof id === "string" ? id : (id as mongoose.Types.ObjectId).toString()
      );
    }
  }
  return out;
}

export class ProjectDeviceConfigurationServiceError extends Error {
  statusCode: number;
  errorCode: string;
  data?: unknown;

  constructor(options: {
    statusCode: number;
    errorCode: string;
    message: string;
    data?: unknown;
  }) {
    super(options.message);
    this.name = "ProjectDeviceConfigurationServiceError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

function toObjectId(
  id: string | mongoose.Types.ObjectId
): mongoose.Types.ObjectId {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

function collectDeviceTypeIdsFromRecipeSteps(
  steps: Array<{ deviceTypeId?: mongoose.Types.ObjectId | null }>
): Set<string> {
  const ids = new Set<string>();
  for (const step of steps || []) {
    if (step.deviceTypeId == null) {
      throw new ProjectDeviceConfigurationServiceError({
        statusCode: 400,
        errorCode: DeviceConfigurationErrorCode.MISSING_STEP_DEVICE_TYPE,
        message: "One or more recipe steps are missing deviceTypeId."
      });
    }
    ids.add(step.deviceTypeId.toString());
  }
  return ids;
}

export class ProjectDeviceConfigurationService {
  async getByProjectId(projectId: string) {
    const pid = toObjectId(projectId);
    return ProjectDeviceConfiguration.findOne({ projectId: pid });
  }

  async upsertFull(
    projectId: string,
    byDeviceType: DeviceConfigurationByDeviceType,
    userId: string | mongoose.Types.ObjectId
  ): Promise<{ configuration: IProjectDeviceConfiguration; created: boolean }> {
    await this.validateDeviceConfigurationPayload(projectId, byDeviceType);
    const pid = toObjectId(projectId);
    const uid = toObjectId(userId);

    const map = new Map<string, mongoose.Types.ObjectId[]>();
    for (const [deviceTypeId, deviceIds] of Object.entries(byDeviceType)) {
      map.set(
        deviceTypeId,
        deviceIds.map((id) => new mongoose.Types.ObjectId(id))
      );
    }

    const existing = await ProjectDeviceConfiguration.findOne({
      projectId: pid
    });
    if (existing) {
      existing.byDeviceType = map;
      existing.updatedBy = uid;
      await existing.save();
      return { configuration: existing, created: false };
    }

    const configuration = await ProjectDeviceConfiguration.create({
      projectId: pid,
      byDeviceType: map,
      createdBy: uid,
      updatedBy: uid
    });
    return { configuration, created: true };
  }

  async deleteByProjectId(projectId: string) {
    const pid = toObjectId(projectId);
    await ProjectDeviceConfiguration.deleteOne({ projectId: pid });
  }

  /**
   * When a recipe document is updated: remove device configuration for every
   * PLANNING project that references this recipe directly (`project.recipe`) or
   * through a product that lists this recipe (`product.recipes.recipeId`).
   * Idempotent when no configuration documents exist.
   */
  async deleteForPlanningProjectsReferencingRecipe(
    recipeId: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const rid = toObjectId(recipeId);

    const productsWithRecipe = await Product.find({
      "recipes.recipeId": rid
    })
      .select("_id")
      .lean();

    const productIds = productsWithRecipe.map((p) => p._id);

    const orConditions: Array<Record<string, unknown>> = [{ recipe: rid }];
    if (productIds.length > 0) {
      orConditions.push({ product: { $in: productIds } });
    }

    const projects = await Project.find({
      status: ProjectStatus.PLANNING,
      $or: orConditions
    })
      .select("_id")
      .lean();

    if (projects.length === 0) {
      return;
    }

    await ProjectDeviceConfiguration.deleteMany({
      projectId: { $in: projects.map((p) => p._id) }
    });
  }

  /**
   * Required device type ids from live Recipe (project.recipe) or union of live
   * Product recipes (project.product). Throws if any step lacks deviceTypeId.
   */
  async computeRequiredDeviceTypesFromLiveProject(
    projectId: string
  ): Promise<Set<string>> {
    const project = await Project.findById(projectId)
      .select("product recipe")
      .lean();
    if (!project) {
      throw new ProjectDeviceConfigurationServiceError({
        statusCode: 404,
        errorCode: DeviceConfigurationErrorCode.NOT_FOUND,
        message: "Project not found."
      });
    }

    const ids = new Set<string>();

    if (project.recipe) {
      const recipe = await Recipe.findById(project.recipe)
        .select("steps")
        .lean();
      if (!recipe) {
        throw new ProjectDeviceConfigurationServiceError({
          statusCode: 404,
          errorCode: DeviceConfigurationErrorCode.NOT_FOUND,
          message: "Recipe not found for project."
        });
      }
      for (const id of collectDeviceTypeIdsFromRecipeSteps(
        (
          recipe as {
            steps?: Array<{ deviceTypeId?: mongoose.Types.ObjectId }>;
          }
        ).steps || []
      )) {
        ids.add(id);
      }
      return ids;
    }

    if (project.product) {
      const product = await Product.findById(project.product)
        .select("recipes")
        .setOptions({ populateFields: false })
        .lean();
      if (!product) {
        throw new ProjectDeviceConfigurationServiceError({
          statusCode: 404,
          errorCode: DeviceConfigurationErrorCode.NOT_FOUND,
          message: "Product not found for project."
        });
      }

      for (const pr of product.recipes || []) {
        const ref = pr.recipeId as unknown;
        let steps: Array<{ deviceTypeId?: mongoose.Types.ObjectId }> = [];

        if (
          ref &&
          typeof ref === "object" &&
          "steps" in ref &&
          Array.isArray((ref as { steps: unknown }).steps)
        ) {
          steps = (
            ref as { steps: Array<{ deviceTypeId?: mongoose.Types.ObjectId }> }
          ).steps;
        } else {
          const recipeId =
            ref instanceof mongoose.Types.ObjectId
              ? ref
              : new mongoose.Types.ObjectId(String(ref));
          const recipe = await Recipe.findById(recipeId).select("steps").lean();
          if (!recipe) {
            continue;
          }
          steps =
            (
              recipe as {
                steps?: Array<{ deviceTypeId?: mongoose.Types.ObjectId }>;
              }
            ).steps || [];
        }

        for (const id of collectDeviceTypeIdsFromRecipeSteps(steps)) {
          ids.add(id);
        }
      }
      return ids;
    }

    return ids;
  }

  /**
   * Required device types from live recipe/product, ordered and labeled for UI.
   * Uses {@link computeRequiredDeviceTypesFromLiveProject} (same validation rules).
   */
  async getRequiredDeviceTypesWithNames(
    projectId: string
  ): Promise<{ deviceTypeId: string; name: string }[]> {
    const idSet = await this.computeRequiredDeviceTypesFromLiveProject(
      projectId
    );
    const orderedIds = [...idSet];
    if (orderedIds.length === 0) {
      return [];
    }

    const objectIds = orderedIds.map((id) => new mongoose.Types.ObjectId(id));
    const types = await DeviceType.find({ _id: { $in: objectIds } })
      .select("name")
      .lean();

    const byId = new Map<string, string>(
      types.map((t) => [String(t._id), t.name])
    );

    return orderedIds.map((deviceTypeId) => ({
      deviceTypeId,
      name: byId.get(deviceTypeId) ?? "Unknown device type"
    }));
  }

  async validateDeviceConfigurationPayload(
    projectId: string,
    byDeviceType: DeviceConfigurationByDeviceType
  ): Promise<void> {
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new ProjectDeviceConfigurationServiceError({
        statusCode: 404,
        errorCode: DeviceConfigurationErrorCode.NOT_FOUND,
        message: "Project not found."
      });
    }

    if (project.status !== ProjectStatus.PLANNING) {
      throw new ProjectDeviceConfigurationServiceError({
        statusCode: 400,
        errorCode: DeviceConfigurationErrorCode.NOT_IN_PLANNING,
        message:
          "Device configuration can only be changed while the project is in PLANNING."
      });
    }

    for (const [deviceTypeKey, value] of Object.entries(byDeviceType)) {
      if (!Array.isArray(value)) {
        throw new ProjectDeviceConfigurationServiceError({
          statusCode: 400,
          errorCode: DeviceConfigurationErrorCode.INVALID_PAYLOAD,
          message: `byDeviceType["${deviceTypeKey}"] must be an array of device ids.`
        });
      }

      if (!mongoose.isValidObjectId(deviceTypeKey)) {
        throw new ProjectDeviceConfigurationServiceError({
          statusCode: 400,
          errorCode: DeviceConfigurationErrorCode.INVALID_PAYLOAD,
          message: `Invalid deviceTypeId key: "${deviceTypeKey}".`
        });
      }

      const seen = new Set<string>();
      for (const rawId of value) {
        if (typeof rawId !== "string" || !mongoose.isValidObjectId(rawId)) {
          throw new ProjectDeviceConfigurationServiceError({
            statusCode: 400,
            errorCode: DeviceConfigurationErrorCode.INVALID_DEVICE,
            message: `Invalid device id under device type "${deviceTypeKey}".`
          });
        }
        if (seen.has(rawId)) {
          throw new ProjectDeviceConfigurationServiceError({
            statusCode: 400,
            errorCode: DeviceConfigurationErrorCode.DUPLICATE_DEVICE,
            message: `Duplicate device id in list for device type "${deviceTypeKey}".`
          });
        }
        seen.add(rawId);

        const device = await Device.findById(rawId)
          .select("deviceTypeId isActive")
          .lean();
        if (!device) {
          throw new ProjectDeviceConfigurationServiceError({
            statusCode: 400,
            errorCode: DeviceConfigurationErrorCode.INVALID_DEVICE,
            message: `Device not found: ${rawId}.`
          });
        }

        if (device.isActive === false) {
          throw new ProjectDeviceConfigurationServiceError({
            statusCode: 400,
            errorCode: DeviceConfigurationErrorCode.INACTIVE_DEVICE,
            message: `Device is inactive or removed: ${rawId}.`
          });
        }

        const dtid = (device as { deviceTypeId: mongoose.Types.ObjectId })
          .deviceTypeId;
        if (dtid.toString() !== deviceTypeKey) {
          throw new ProjectDeviceConfigurationServiceError({
            statusCode: 400,
            errorCode: DeviceConfigurationErrorCode.DEVICE_TYPE_MISMATCH,
            message: `Device ${rawId} does not belong to device type ${deviceTypeKey}.`
          });
        }
      }
    }
  }

  /**
   * Enforces non-empty device list for each required device type (live recipe/product).
   * Extra keys in `byDeviceType` are ignored.
   */
  async validateCoverageForStart(
    projectId: string,
    byDeviceType: DeviceConfigurationByDeviceType
  ): Promise<void> {
    const required = await this.computeRequiredDeviceTypesFromLiveProject(
      projectId
    );

    for (const deviceTypeId of required) {
      const list = byDeviceType[deviceTypeId];
      if (!list || list.length === 0) {
        throw new ProjectDeviceConfigurationServiceError({
          statusCode: 400,
          errorCode: DeviceConfigurationErrorCode.INCOMPLETE,
          message:
            "Device configuration is incomplete for required device types."
        });
      }
    }
  }
}

export const projectDeviceConfigurationService =
  new ProjectDeviceConfigurationService();
