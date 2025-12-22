import { Request, Response } from "express";
import { GridLayout } from "../models/GridLayout";
import { Device } from "../models/Device";
import { realtimeService } from "../services/realtimeService";
import { APIResponse, AuthenticatedRequest } from "../types";

/**
 * Get all grid layouts
 * GET /api/grid-layouts
 */
export const getGridLayouts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 20, isMonitorDisplay } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query filter
    const query: any = {};
    if (isMonitorDisplay === 'true') {
      query.isMonitorDisplay = true;
    }

    const total = await GridLayout.countDocuments(query);
    const layouts = await GridLayout.find(query)
      .populate("createdBy", "name email username")
      .populate({
        path: "devices.deviceId",
        select: "name status deviceTypeId location currentUser currentTask",
        populate: [
          { path: "deviceType", select: "_id name" },
          { path: "currentUser", select: "_id name username" },
          { path: "currentTask", select: "_id title status progress" }
        ]
      })
      .skip(skip)
      .limit(limitNum)
      .sort({ isDefault: -1, createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Grid layouts retrieved successfully",
      data: {
        items: layouts,
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
    console.error("Get grid layouts error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get grid layout by ID
 * GET /api/grid-layouts/:id
 */
export const getGridLayoutById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const layout = await GridLayout.findById(id)
      .populate("createdBy", "name email username")
      .populate("devices.deviceId", "name status deviceTypeId location");

    if (!layout) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Grid layout not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Grid layout retrieved successfully",
      data: layout
    };

    res.json(response);
  } catch (error) {
    console.error("Get grid layout error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Create new grid layout
 * POST /api/grid-layouts
 */
export const createGridLayout = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      description,
      columns,
      rows,
      devices,
      isDefault,
      isMonitorDisplay
    } = req.body;

    // Validation
    if (!name) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name is required"
      };
      res.status(400).json(response);
      return;
    }

    // Check if name already exists
    const existingLayout = await GridLayout.findOne({ name });
    if (existingLayout) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "A grid layout with this name already exists"
      };
      res.status(400).json(response);
      return;
    }

    // Validate devices exist
    if (devices && devices.length > 0) {
      const deviceIds = devices.map((d: any) => d.deviceId);
      const existingDevices = await Device.find({
        _id: { $in: deviceIds }
      }).setOptions({ includeDeleted: false });

      if (existingDevices.length !== deviceIds.length) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "One or more devices not found"
        };
        res.status(400).json(response);
        return;
      }

      // Validate positions are within grid bounds
      for (const device of devices) {
        if (
          device.row < 0 ||
          device.column < 0 ||
          device.row + device.rowSpan > (rows || 10) ||
          device.column + device.colSpan > (columns || 12)
        ) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: `Device position or size exceeds grid bounds`
          };
          res.status(400).json(response);
          return;
        }
      }
    }

    const layout = new GridLayout({
      name,
      description,
      columns: columns || 12,
      rows: rows || 10,
      devices: devices || [],
      isDefault: isDefault || false,
      isMonitorDisplay: isMonitorDisplay || false,
      createdBy: req.user?._id
    });

    await layout.save();
    await layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);

    const response: APIResponse = {
      success: true,
      message: "Grid layout created successfully",
      data: layout
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create grid layout error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Update grid layout
 * PATCH /api/grid-layouts/:id
 */
export const updateGridLayout = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      columns,
      rows,
      devices,
      isDefault,
      isMonitorDisplay
    } = req.body;

    const layout = await GridLayout.findById(id);

    if (!layout) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Grid layout not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if name is being changed and if it conflicts
    if (name && name !== layout.name) {
      const existingLayout = await GridLayout.findOne({
        name,
        _id: { $ne: id }
      });
      if (existingLayout) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "A grid layout with this name already exists"
        };
        res.status(400).json(response);
        return;
      }
    }

    // Validate devices if provided
    if (devices) {
      const deviceIds = devices.map((d: any) => d.deviceId);
      const existingDevices = await Device.find({
        _id: { $in: deviceIds }
      }).setOptions({ includeDeleted: false });

      if (existingDevices.length !== deviceIds.length) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "One or more devices not found"
        };
        res.status(400).json(response);
        return;
      }

      // Validate positions are within grid bounds
      const gridRows = rows !== undefined ? rows : layout.rows;
      const gridCols = columns !== undefined ? columns : layout.columns;

      for (const device of devices) {
        if (
          device.row < 0 ||
          device.column < 0 ||
          device.row + device.rowSpan > gridRows ||
          device.column + device.colSpan > gridCols
        ) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: `Device position or size exceeds grid bounds`
          };
          res.status(400).json(response);
          return;
        }
      }
    }

    // Update fields
    if (name !== undefined) layout.name = name;
    if (description !== undefined) layout.description = description;
    if (columns !== undefined) layout.columns = columns;
    if (rows !== undefined) layout.rows = rows;
    if (devices !== undefined) layout.devices = devices;
    if (isDefault !== undefined) layout.isDefault = isDefault;
    
    // Track if isMonitorDisplay changed for WebSocket notification
    const isMonitorDisplayChanged = isMonitorDisplay !== undefined && 
      layout.isMonitorDisplay !== isMonitorDisplay;
    const oldIsMonitorDisplay = layout.isMonitorDisplay;
    
    if (isMonitorDisplay !== undefined)
      layout.isMonitorDisplay = isMonitorDisplay;

    await layout.save();
    await layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);

    // Emit WebSocket event if isMonitorDisplay toggled
    if (isMonitorDisplayChanged) {
      realtimeService.emitLayoutMonitorDisplayToggled({
        layoutId: layout._id.toString(),
        layoutName: layout.name,
        isMonitorDisplay: layout.isMonitorDisplay,
        previousValue: oldIsMonitorDisplay,
        timestamp: Date.now()
      });
    }

    const response: APIResponse = {
      success: true,
      message: "Grid layout updated successfully",
      data: layout
    };

    res.json(response);
  } catch (error: any) {
    console.error("Update grid layout error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Update device position in grid layout
 * PATCH /api/grid-layouts/:id/devices/:deviceId
 */
export const updateDevicePosition = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, deviceId } = req.params;
    const { row, column, rowSpan, colSpan } = req.body;

    const layout = await GridLayout.findById(id);

    if (!layout) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Grid layout not found"
      };
      res.status(404).json(response);
      return;
    }

    // Find device in layout
    const deviceIndex = layout.devices.findIndex(
      (d) => d.deviceId.toString() === deviceId
    );

    if (deviceIndex === -1) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found in this layout"
      };
      res.status(404).json(response);
      return;
    }

    // Validate new position/size
    const newRow = row !== undefined ? row : layout.devices[deviceIndex].row;
    const newCol =
      column !== undefined ? column : layout.devices[deviceIndex].column;
    const newRowSpan =
      rowSpan !== undefined ? rowSpan : layout.devices[deviceIndex].rowSpan;
    const newColSpan =
      colSpan !== undefined ? colSpan : layout.devices[deviceIndex].colSpan;

    if (
      newRow < 0 ||
      newCol < 0 ||
      newRow + newRowSpan > layout.rows ||
      newCol + newColSpan > layout.columns
    ) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Device position or size exceeds grid bounds"
      };
      res.status(400).json(response);
      return;
    }

    // Update device position
    if (row !== undefined) layout.devices[deviceIndex].row = row;
    if (column !== undefined) layout.devices[deviceIndex].column = column;
    if (rowSpan !== undefined) layout.devices[deviceIndex].rowSpan = rowSpan;
    if (colSpan !== undefined) layout.devices[deviceIndex].colSpan = colSpan;

    await layout.save();
    await layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);

    const response: APIResponse = {
      success: true,
      message: "Device position updated successfully",
      data: layout
    };

    res.json(response);
  } catch (error) {
    console.error("Update device position error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Bulk update device positions in grid layout
 * PATCH /api/grid-layouts/:id/devices
 */
export const bulkUpdateDevicePositions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { devices } = req.body;

    if (!devices || !Array.isArray(devices)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "devices array is required"
      };
      res.status(400).json(response);
      return;
    }

    const layout = await GridLayout.findById(id);

    if (!layout) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Grid layout not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate all devices exist in the layout and positions are valid
    for (const deviceUpdate of devices) {
      const deviceIndex = layout.devices.findIndex(
        (d) => d.deviceId.toString() === deviceUpdate.deviceId
      );

      if (deviceIndex === -1) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: `Device ${deviceUpdate.deviceId} not found in this layout`
        };
        res.status(400).json(response);
        return;
      }

      if (
        deviceUpdate.row < 0 ||
        deviceUpdate.column < 0 ||
        deviceUpdate.row + deviceUpdate.rowSpan > layout.rows ||
        deviceUpdate.column + deviceUpdate.colSpan > layout.columns
      ) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: `Device ${deviceUpdate.deviceId} position or size exceeds grid bounds`
        };
        res.status(400).json(response);
        return;
      }
    }

    // Update all device positions
    for (const deviceUpdate of devices) {
      const deviceIndex = layout.devices.findIndex(
        (d) => d.deviceId.toString() === deviceUpdate.deviceId
      );

      layout.devices[deviceIndex].row = deviceUpdate.row;
      layout.devices[deviceIndex].column = deviceUpdate.column;
      layout.devices[deviceIndex].rowSpan = deviceUpdate.rowSpan;
      layout.devices[deviceIndex].colSpan = deviceUpdate.colSpan;
    }

    await layout.save();
    await layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);

    const response: APIResponse = {
      success: true,
      message: "Device positions updated successfully",
      data: layout
    };

    res.json(response);
  } catch (error) {
    console.error("Bulk update device positions error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Delete grid layout
 * DELETE /api/grid-layouts/:id
 */
export const deleteGridLayout = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const layout = await GridLayout.findByIdAndDelete(id);

    if (!layout) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Grid layout not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Grid layout deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete grid layout error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
