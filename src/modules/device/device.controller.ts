import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { deviceService } from "./device.service";
import { Device } from "./device.model";
import { AuthenticatedRequest, APIResponse } from "@shared/types";
import { Alert } from "../../models";
import { GridLayout } from "../../models";
import { DeviceType } from "../../models/DeviceType";
import { realtimeService } from "@shared/services";
import { isDeviceOccupied } from "../../services/deviceOccupationService";

export class DeviceController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await deviceService.list(req.query as any);
      const response: APIResponse = {
        success: true,
        message: "Devices retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await deviceService.getById(req.params.id);
      if (!item) {
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
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || !req.user.role || req.user.role !== "admin") {
        const response: APIResponse = {
          success: false,
          error: "FORBIDDEN",
          message: "Admin privileges required to register device"
        };
        res.status(403).json(response);
        return;
      }

      const { name, deviceTypeId } = req.body;

      if (!name || !deviceTypeId) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Name and deviceTypeId are required"
        };
        res.status(400).json(response);
        return;
      }

      const deviceType = await DeviceType.findById(deviceTypeId).setOptions({
        includeDeleted: false
      });
      if (!deviceType) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: `Device type not found: ${deviceTypeId}`
        };
        res.status(404).json(response);
        return;
      }

      const isDuplicate = await deviceService.checkDuplicateName(name);
      if (isDuplicate) {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_DEVICE_NUMBER",
          message: "Device number is duplicated"
        };
        res.status(409).json(response);
        return;
      }

      const item = await deviceService.create(req.body);
      const populatedItem = await item.populate("deviceType", "name description");

      const response: APIResponse = {
        success: true,
        message: "Device registered successfully",
        data: populatedItem
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, deviceTypeId, status } = req.body;

      const device = await Device.findById(id).setOptions({ includeDeleted: false });

      if (!device) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device not found"
        };
        res.status(404).json(response);
        return;
      }

      if (deviceTypeId) {
        const deviceType = await DeviceType.findById(deviceTypeId).setOptions({
          includeDeleted: false
        });
        if (!deviceType) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: `Device type not found: ${deviceTypeId}`
          };
          res.status(404).json(response);
          return;
        }
      }

      if (name && name !== device.name) {
        const isDuplicate = await deviceService.checkDuplicateName(name, id);
        if (isDuplicate) {
          const response: APIResponse = {
            success: false,
            error: "DUPLICATE_DEVICE_NUMBER",
            message: "Device number is duplicated"
          };
          res.status(409).json(response);
          return;
        }
      }

      const statusChanged = !!(status && status !== device.status);
      if (statusChanged && device.status === "MAINTENANCE" && status !== "MAINTENANCE") {
        const alert = await Alert.findOne({
          device: device._id,
          level: { $in: ["CRITICAL", "HIGH"] },
          status: { $ne: "RESOLVED" }
        });
        if (alert) {
          const response: APIResponse = {
            success: false,
            error: "CONFLICT",
            message: "장비가 점검중입니다. 관리자의 조치 후 재개 가능합니다."
          };
          res.status(409).json(response);
          return;
        }
      }

      const item = await deviceService.update(
        id,
        req.body,
        req.user?._id as mongoose.Types.ObjectId | undefined,
        req.user?.name
      );

      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device not found"
        };
        res.status(404).json(response);
        return;
      }

      if (statusChanged) {
        realtimeService
          .broadcastDeviceUpdate(item)
          .catch((err) => console.error("Failed to broadcast device update:", err));
      }

      const populatedItem = await item.populate("deviceType", "name description");

      const response: APIResponse = {
        success: true,
        message: "Device updated successfully",
        data: populatedItem
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const device = await deviceService.softDelete(id);

      if (!device) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device not found"
        };
        res.status(404).json(response);
        return;
      }

      const layouts = await GridLayout.find({ "devices.deviceId": id });
      if (layouts.length > 0) {
        for (const layout of layouts) {
          layout.devices = layout.devices.filter((d: any) => d.deviceId.toString() !== id);
          await layout.save();
        }
      }

      const response: APIResponse = {
        success: true,
        message: "Device deleted successfully"
      };
      res.json(response);
    } catch (error: any) {
      if (error.message && error.message.includes("Cannot delete device")) {
        const response: APIResponse = {
          success: false,
          error: "CONFLICT",
          message: error.message
        };
        res.status(409).json(response);
        return;
      }
      next(error);
    }
  }

  async getStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await deviceService.getStatistics(req.query as any);
      const response: APIResponse = {
        success: true,
        message: "Device statistics retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getDevicesByTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await deviceService.getDevicesByTask(req.query as any);
      const response: APIResponse = {
        success: true,
        message: "Devices with tasks retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getMonitorData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const gridLayout = await GridLayout.findById(id).populate({
        path: "devices.deviceId",
        populate: [
          {
            path: "deviceType",
            select: "name"
          },
          {
            path: "currentTask",
            select: "title status startedAt"
          },
          {
            path: "currentUser",
            select: "name username"
          }
        ]
      });

      if (!gridLayout) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Grid layout not found"
        };
        res.status(404).json(response);
        return;
      }

      const summary = {
        totalDevices: gridLayout.devices.length,
        onlineDevices: gridLayout.devices.filter(
          (d) => d.deviceId && (d.deviceId as any).status === "ONLINE"
        ).length,
        offlineDevices: gridLayout.devices.filter(
          (d) => d.deviceId && (d.deviceId as any).status === "OFFLINE"
        ).length,
        maintenanceDevices: gridLayout.devices.filter(
          (d) => d.deviceId && (d.deviceId as any).status === "MAINTENANCE"
        ).length,
        errorDevices: gridLayout.devices.filter(
          (d) => d.deviceId && (d.deviceId as any).status === "ERROR"
        ).length
      };

      const response: APIResponse = {
        success: true,
        message: "Devices monitor data retrieved successfully",
        data: {
          layout: gridLayout,
          summary
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async workerLogin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!req.user) {
        const response: APIResponse = {
          success: false,
          error: "UNAUTHORIZED",
          message: "Authentication required"
        };
        res.status(401).json(response);
        return;
      }

      const device = await deviceService.setCurrentUser(id, req.user._id as any);

      if (!device) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device not found"
        };
        res.status(404).json(response);
        return;
      }

      await realtimeService.broadcastDeviceUpdate(device);

      const response: APIResponse = {
        success: true,
        message: "Worker logged in to device successfully",
        data: device
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async workerLogout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const device = await deviceService.clearCurrentUser(id);

      if (!device) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device not found"
        };
        res.status(404).json(response);
        return;
      }

      await realtimeService.broadcastDeviceUpdate(device);

      const response: APIResponse = {
        success: true,
        message: "Worker logged out from device successfully",
        data: device
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async checkAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Device ID is required"
        };
        res.status(400).json(response);
        return;
      }

      const device = await Device.findById(id).setOptions({ includeDeleted: false });

      if (!device) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device not found"
        };
        res.status(404).json(response);
        return;
      }

      const occupation = await isDeviceOccupied(id);

      const response: APIResponse = {
        success: true,
        message: occupation.isOccupied
          ? "Device is currently occupied"
          : "Device is available",
        data: {
          deviceId: id,
          available: !occupation.isOccupied,
          occupied: occupation.isOccupied,
          occupiedBy: occupation.socketId || null
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const deviceController = new DeviceController();
