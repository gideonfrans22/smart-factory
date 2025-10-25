import { Request, Response } from "express";
import { DeviceType } from "../models";
import mongoose from "mongoose";

/**
 * Get all device types
 */
export const getAllDeviceTypes = async (_: Request, res: Response) => {
  try {
    const deviceTypes = await DeviceType.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: deviceTypes.length,
      data: deviceTypes
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching device types",
      error: error.message
    });
  }
};

/**
 * Get a single device type by ID
 */
export const getDeviceTypeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid device type ID"
      });
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      return res.status(404).json({
        success: false,
        message: "Device type not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: deviceType
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching device type",
      error: error.message
    });
  }
};

/**
 * Get all devices of a specific device type
 */
export const getDevicesByType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid device type ID"
      });
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      return res.status(404).json({
        success: false,
        message: "Device type not found"
      });
    }

    const Device = mongoose.model("Device");
    const devices = await Device.find({ deviceTypeId: id }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      deviceType: {
        _id: deviceType._id,
        name: deviceType.name
      },
      count: devices.length,
      data: devices
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching devices by type",
      error: error.message
    });
  }
};

/**
 * Get available (ONLINE) devices of a specific device type
 */
export const getAvailableDevicesByType = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid device type ID"
      });
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      return res.status(404).json({
        success: false,
        message: "Device type not found"
      });
    }

    const Device = mongoose.model("Device");
    const availableDevices = await Device.find({
      deviceTypeId: id,
      status: "ONLINE"
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      deviceType: {
        _id: deviceType._id,
        name: deviceType.name
      },
      count: availableDevices.length,
      data: availableDevices
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching available devices",
      error: error.message
    });
  }
};

/**
 * Create a new device type
 */
export const createDeviceType = async (req: Request, res: Response) => {
  try {
    const { name, description, specifications } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    // Check if device type with same name already exists
    const existingDeviceType = await DeviceType.findOne({
      name: name.trim()
    });

    if (existingDeviceType) {
      return res.status(400).json({
        success: false,
        message: `Device type with name "${name}" already exists`
      });
    }

    const deviceType = await DeviceType.create({
      name: name.trim(),
      description: description?.trim(),
      specifications
    });

    return res.status(201).json({
      success: true,
      message: "Device type created successfully",
      data: deviceType
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Device type with this name already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error creating device type",
      error: error.message
    });
  }
};

/**
 * Update a device type
 */
export const updateDeviceType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, specifications } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid device type ID"
      });
    }

    const deviceType = await DeviceType.findById(id);

    if (!deviceType) {
      return res.status(404).json({
        success: false,
        message: "Device type not found"
      });
    }

    // Check if new name conflicts with existing device type
    if (name && name.trim() !== deviceType.name) {
      const existingDeviceType = await DeviceType.findOne({
        name: name.trim(),
        _id: { $ne: id }
      });

      if (existingDeviceType) {
        return res.status(400).json({
          success: false,
          message: `Device type with name "${name}" already exists`
        });
      }
    }

    // Update fields
    if (name) deviceType.name = name.trim();
    if (description !== undefined) deviceType.description = description?.trim();
    if (specifications !== undefined)
      deviceType.specifications = specifications;

    await deviceType.save();

    return res.status(200).json({
      success: true,
      message: "Device type updated successfully",
      data: deviceType
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Device type with this name already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error updating device type",
      error: error.message
    });
  }
};

/**
 * Delete a device type
 */
export const deleteDeviceType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid device type ID"
      });
    }

    const deviceType = await DeviceType.findByIdAndDelete(id);

    if (!deviceType) {
      return res.status(404).json({
        success: false,
        message: "Device type not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Device type deleted successfully",
      data: deviceType
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Error deleting device type"
    });
  }
};
