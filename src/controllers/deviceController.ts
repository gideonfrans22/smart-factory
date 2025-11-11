import { Request, Response } from "express";
import { Device } from "../models/Device";
import { DeviceType } from "../models/DeviceType";
import { APIResponse, AuthenticatedRequest } from "../types";

export const getDevices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query: any = {};
    if (status) query.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Device.countDocuments(query);
    const devices = await Device.find(query)
      .populate("deviceType", "name description")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Devices retrieved successfully",
      data: {
        items: devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get devices error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getDeviceById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const device = await Device.findById(id).populate(
      "deviceType",
      "name description"
    );

    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Device retrieved successfully",
      data: device
    };

    res.json(response);
  } catch (error) {
    console.error("Get device error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const registerDevice = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      deviceTypeId,
      location,
      status,
      ipAddress,
      macAddress,
      config
    } = req.body;

    if (!name || !deviceTypeId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name, and deviceTypeId are required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate deviceTypeId exists
    const deviceType = await DeviceType.findById(deviceTypeId);
    if (!deviceType) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: `Device type not found: ${deviceTypeId}`
      };
      res.status(404).json(response);
      return;
    }

    // Duplicate check: device name/number must be unique
    const existingDevice = await Device.findOne({ name });
    if (existingDevice) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_DEVICE_NUMBER",
        message: "Device number is duplicated"
      };
      res.status(409).json(response);
      return;
    }

    const device = new Device({
      name,
      deviceTypeId,
      location,
      ipAddress,
      macAddress,
      status,
      config,
      lastHeartbeat: new Date()
    });

    await device.save();

    const response: APIResponse = {
      success: true,
      message: "Device registered successfully",
      data: await device.populate("deviceType", "name description")
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Register device error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const updateDevice = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, deviceTypeId, location, status, ipAddress, config } =
      req.body;

    const device = await Device.findById(id);

    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate deviceTypeId if provided
    if (deviceTypeId) {
      const deviceType = await DeviceType.findById(deviceTypeId);
      if (!deviceType) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: `Device type not found: ${deviceTypeId}`
        };
        res.status(404).json(response);
        return;
      }
      device.deviceTypeId = deviceTypeId;
    }

    // Duplicate check: device name/number must be unique (if name is being updated)
    if (name && name !== device.name) {
      const existingDevice = await Device.findOne({ name });
      if (existingDevice && existingDevice._id.toString() !== device._id.toString()) {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_DEVICE_NUMBER",
          message: "Device number is duplicated"
        };
        res.status(409).json(response);
        return;
      }
      device.name = name;
    }
    if (location) device.location = location;
    if (status) device.status = status;
    if (ipAddress) device.ipAddress = ipAddress;
    if (config) device.config = config;

    // Update heartbeat if status is being updated
    if (status) {
      device.lastHeartbeat = new Date();
    }

    await device.save();

    const response: APIResponse = {
      success: true,
      message: "Device updated successfully",
      data: await device.populate("deviceType", "name description")
    };

    res.json(response);
  } catch (error) {
    console.error("Update device error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const deleteDevice = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const device = await Device.findByIdAndDelete(id);

    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Device deleted successfully"
    };

    res.json(response);
  } catch (error: any) {
    console.error("Delete device error:", error);

    // Check if error is due to recipe step dependency
    if (error.message && error.message.includes("Cannot delete device")) {
      const response: APIResponse = {
        success: false,
        error: "CONFLICT",
        message: error.message
      };
      res.status(409).json(response);
      return;
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
