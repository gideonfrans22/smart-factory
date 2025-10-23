import { Request, Response } from "express";
import { Device } from "../models/Device";
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
    const { name, type, location, status, ipAddress, macAddress, config } =
      req.body;

    if (!name || !type) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name and type are required"
      };
      res.status(400).json(response);
      return;
    }

    const device = new Device({
      name,
      type,
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
      data: device
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
    const { name, location, status, ipAddress, config } = req.body;

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

    if (name) device.name = name;
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
      data: device
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
  } catch (error) {
    console.error("Delete device error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
