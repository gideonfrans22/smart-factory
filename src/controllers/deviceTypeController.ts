import { Request, Response } from "express";
import { DeviceType } from "../models";
import { Device } from "../models/Device";
import { APIResponse } from "../types";
import mongoose from "mongoose";

/**
 * Get all device types
 */
export const getAllDeviceTypes = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const deviceTypes = await DeviceType.find()
      .populate("devices")
      .sort({ name: 1 });

    const response: APIResponse = {
      success: true,
      message: "Device types retrieved successfully",
      data: {
        count: deviceTypes.length,
        items: deviceTypes
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get device types error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get a single device type by ID
 */
export const getDeviceTypeById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid device type ID"
      };
      res.status(400).json(response);
      return;
    }

    const deviceType = await DeviceType.findById(id).populate("devices");

    if (!deviceType) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device type not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Device type retrieved successfully",
      data: deviceType
    };

    res.json(response);
  } catch (error) {
    console.error("Get device type error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get all devices of a specific device type
 */
export const getDevicesByType = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid device type ID"
      };
      res.status(400).json(response);
      return;
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device type not found"
      };
      res.status(404).json(response);
      return;
    }

    const devices = await Device.find({ deviceTypeId: id }).sort({ name: 1 });

    const response: APIResponse = {
      success: true,
      message: "Devices retrieved successfully",
      data: {
        deviceType: {
          _id: deviceType._id,
          name: deviceType.name
        },
        count: devices.length,
        items: devices
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get devices by type error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get available (ONLINE) devices of a specific device type
 */
export const getAvailableDevicesByType = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid device type ID"
      };
      res.status(400).json(response);
      return;
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device type not found"
      };
      res.status(404).json(response);
      return;
    }

    const availableDevices = await Device.find({
      deviceTypeId: id,
      status: "ONLINE"
    }).sort({ name: 1 });

    const response: APIResponse = {
      success: true,
      message: "Available devices retrieved successfully",
      data: {
        deviceType: {
          _id: deviceType._id,
          name: deviceType.name
        },
        count: availableDevices.length,
        items: availableDevices
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get available devices error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Create a new device type
 */
export const createDeviceType = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, description, specifications } = req.body;

    // Validate required fields
    if (!name) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name is required"
      };
      res.status(400).json(response);
      return;
    }

    // Check if device type with same name already exists
    const existingDeviceType = await DeviceType.findOne({
      name: name.trim()
    });

    if (existingDeviceType) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Device type with name "${name}" already exists`
      };
      res.status(400).json(response);
      return;
    }

    const deviceType = await DeviceType.create({
      name: name.trim(),
      description: description?.trim(),
      specifications
    });

    const response: APIResponse = {
      success: true,
      message: "Device type created successfully",
      data: deviceType
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create device type error:", error);

    if (error.code === 11000) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Device type with this name already exists"
      };
      res.status(400).json(response);
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

/**
 * Update a device type
 */
export const updateDeviceType = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, specifications } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid device type ID"
      };
      res.status(400).json(response);
      return;
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device type not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if new name conflicts with existing device type
    if (name && name.trim() !== deviceType.name) {
      const existingDeviceType = await DeviceType.findOne({
        name: name.trim(),
        _id: { $ne: id }
      });

      if (existingDeviceType) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: `Device type with name "${name}" already exists`
        };
        res.status(400).json(response);
        return;
      }
    }

    // Update fields
    if (name) deviceType.name = name.trim();
    if (description !== undefined) deviceType.description = description?.trim();
    if (specifications !== undefined)
      deviceType.specifications = specifications;

    await deviceType.save();

    const response: APIResponse = {
      success: true,
      message: "Device type updated successfully",
      data: deviceType
    };

    res.json(response);
  } catch (error: any) {
    console.error("Update device type error:", error);

    if (error.code === 11000) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Device type with this name already exists"
      };
      res.status(400).json(response);
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

/**
 * Delete a device type
 */
export const deleteDeviceType = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid device type ID"
      };
      res.status(400).json(response);
      return;
    }

    const deviceType = await DeviceType.findByIdAndDelete(id);

    if (!deviceType) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device type not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Device type deleted successfully",
      data: deviceType
    };

    res.json(response);
  } catch (error: any) {
    console.error("Delete device type error:", error);

    // Check if error is due to dependencies (cascade prevention)
    if (error.message && error.message.includes("Cannot delete device type")) {
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
