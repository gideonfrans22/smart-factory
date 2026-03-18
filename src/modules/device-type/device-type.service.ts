import mongoose from "mongoose";
import { DeviceType, IDeviceType } from "./device-type.model";
import {
  DeviceTypeDTO,
  DeviceTypeListResult,
  DeviceTypeUpdateDTO
} from "./device-type.types";
import { Device } from "@modules/device";

export class DeviceTypeService {
  async list(): Promise<DeviceTypeListResult> {
    const deviceTypes = await DeviceType.find()
      .populate("devices")
      .setOptions({ includeDeleted: false })
      .sort({ name: 1 });

    return {
      count: deviceTypes.length,
      items: deviceTypes
    };
  }

  async getById(id: string): Promise<IDeviceType | null> {
    return DeviceType.findById(id).populate("devices");
  }

  async getDevicesByType(id: string) {
    const deviceType = await DeviceType.findById(id);
    if (!deviceType) {
      return null;
    }

    const devices = await Device.find({ deviceTypeId: id })
      .setOptions({ includeDeleted: false })
      .sort({ name: 1 });

    return {
      deviceType: {
        _id: deviceType._id,
        name: deviceType.name
      },
      count: devices.length,
      items: devices
    };
  }

  async getAvailableDevicesByType(id: string) {
    const deviceType = await DeviceType.findById(id);
    if (!deviceType) {
      return null;
    }

    const devices = await Device.find({
      deviceTypeId: id,
      status: "ONLINE"
    })
      .setOptions({ includeDeleted: false })
      .sort({ name: 1 });

    return {
      deviceType: {
        _id: deviceType._id,
        name: deviceType.name
      },
      count: devices.length,
      items: devices
    };
  }

  async create(data: DeviceTypeDTO): Promise<IDeviceType> {
    const existingDeviceType = await DeviceType.findOne({
      name: data.name.trim(),
      isActive: { $ne: false }
    });

    if (existingDeviceType) {
      const error: any = new Error("Type name is duplicated");
      error.code = "DUPLICATE_DEVICE_TYPE_NAME";
      throw error;
    }

    const deviceType = await DeviceType.create({
      name: data.name.trim(),
      description: data.description?.trim(),
      specifications: data.specifications,
      validRecipeStepNames: data.validRecipeStepNames
    });

    return deviceType;
  }

  async update(id: string, data: DeviceTypeUpdateDTO): Promise<IDeviceType | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: any = new Error("Invalid device type ID");
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      return null;
    }

    if (data.name && data.name.trim() !== deviceType.name) {
      const existingDeviceType = await DeviceType.findOne({
        name: data.name.trim(),
        _id: { $ne: id },
        isActive: { $ne: false }
      });

      if (existingDeviceType) {
        const error: any = new Error("Type name is duplicated");
        error.code = "DUPLICATE_DEVICE_TYPE_NAME";
        throw error;
      }
    }

    if (data.name) deviceType.name = data.name.trim();
    if (data.description !== undefined)
      deviceType.description = data.description?.trim();
    if (data.specifications !== undefined)
      deviceType.specifications = data.specifications;
    if (data.validRecipeStepNames !== undefined)
      deviceType.validRecipeStepNames = data.validRecipeStepNames;

    await deviceType.save();

    return deviceType;
  }

  async softDelete(id: string): Promise<IDeviceType | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error: any = new Error("Invalid device type ID");
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      return null;
    }

    const DeviceModel = mongoose.model("Device");
    const devicesWithType = await DeviceModel.findOne({
      deviceTypeId: id,
      isActive: { $ne: false }
    });

    if (devicesWithType) {
      const error: any = new Error(
        `Cannot delete device type: It is referenced by device "${devicesWithType.name}". Please reassign or delete dependent devices first.`
      );
      error.code = "CONFLICT_DEVICE";
      throw error;
    }

    const Recipe = mongoose.model("Recipe");
    const recipesWithDeviceType = await Recipe.findOne({
      "steps.deviceTypeId": id
    });

    if (recipesWithDeviceType) {
      const error: any = new Error(
        `Cannot delete device type: It is referenced by recipe steps in recipe "${recipesWithDeviceType.name}". Please update or delete dependent recipes first.`
      );
      error.code = "CONFLICT_RECIPE";
      throw error;
    }

    const Task = mongoose.model("Task");
    const tasksWithDeviceType = await Task.findOne({
      deviceTypeId: id
    });

    if (tasksWithDeviceType) {
      const error: any = new Error(
        `Cannot delete device type: It is referenced by task "${tasksWithDeviceType.title}". Please update or delete dependent tasks first.`
      );
      error.code = "CONFLICT_TASK";
      throw error;
    }

    (deviceType as any).isActive = false;
    await deviceType.save();

    return deviceType;
  }
}

export const deviceTypeService = new DeviceTypeService();

