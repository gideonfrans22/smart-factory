import mongoose from "mongoose";
import { GridLayout, GridLayoutDocument } from "./grid-layout.model";
import { GridLayoutDTO, GridLayoutUpdateDTO, GridLayoutListFilters, IDevicePosition } from "./grid-layout.types";
import { Device } from "@modules/device";
import { realtimeService } from "@shared/services";

export class GridLayoutService {
  async list(filters: GridLayoutListFilters = {}): Promise<{
    items: GridLayoutDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters.isMonitorDisplay !== undefined) {
      query.isMonitorDisplay = filters.isMonitorDisplay;
    }

    const total = await GridLayout.countDocuments(query);
    const items = await GridLayout.find(query)
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
      .limit(limit)
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async getById(id: string): Promise<GridLayoutDocument | null> {
    return GridLayout.findById(id)
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
      .exec();
  }

  async create(data: GridLayoutDTO, userId?: mongoose.Types.ObjectId): Promise<GridLayoutDocument> {
    const {
      name,
      description,
      columns = 12,
      rows = 10,
      devices = [],
      isDefault = false,
      isMonitorDisplay = false
    } = data;

    const existingLayout = await GridLayout.findOne({ name });
    if (existingLayout) {
      throw new Error("A grid layout with this name already exists");
    }

    if (devices.length > 0) {
      await this.validateDevices(devices, columns, rows);
    }

    const layout = new GridLayout({
      name,
      description,
      columns,
      rows,
      devices,
      isDefault,
      isMonitorDisplay,
      createdBy: userId
    });

    await layout.save();
    return layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);
  }

  async update(
    id: string,
    data: GridLayoutUpdateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<GridLayoutDocument | null> {
    const layout = await GridLayout.findById(id);

    if (!layout) {
      return null;
    }

    const {
      name,
      description,
      columns,
      rows,
      devices,
      isDefault,
      isMonitorDisplay
    } = data;

    if (name && name !== layout.name) {
      const existingLayout = await GridLayout.findOne({
        name,
        _id: { $ne: id }
      });
      if (existingLayout) {
        throw new Error("A grid layout with this name already exists");
      }
    }

    if (devices) {
      const gridRows = rows !== undefined ? rows : layout.rows;
      const gridCols = columns !== undefined ? columns : layout.columns;
      await this.validateDevices(devices, gridCols, gridRows);
    }

    if (name !== undefined) layout.name = name;
    if (description !== undefined) layout.description = description;
    if (columns !== undefined) layout.columns = columns;
    if (rows !== undefined) layout.rows = rows;
    if (devices !== undefined) layout.devices = devices;
    if (isDefault !== undefined) layout.isDefault = isDefault;

    const isMonitorDisplayChanged =
      isMonitorDisplay !== undefined &&
      layout.isMonitorDisplay !== isMonitorDisplay;
    const oldIsMonitorDisplay = layout.isMonitorDisplay;

    if (isMonitorDisplay !== undefined) layout.isMonitorDisplay = isMonitorDisplay;

    layout.modifiedBy = userId;
    await layout.save();
    await layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);

    if (isMonitorDisplayChanged) {
      realtimeService.emitLayoutMonitorDisplayToggled({
        layoutId: layout._id.toString(),
        layoutName: layout.name,
        isMonitorDisplay: layout.isMonitorDisplay,
        previousValue: oldIsMonitorDisplay,
        timestamp: Date.now()
      });
    }

    return layout;
  }

  async updateDevicePosition(
    layoutId: string,
    deviceId: string,
    positionData: Partial<IDevicePosition>
  ): Promise<GridLayoutDocument | null> {
    const layout = await GridLayout.findById(layoutId);

    if (!layout) {
      return null;
    }

    const deviceIndex = layout.devices.findIndex(
      (d) => d.deviceId.toString() === deviceId
    );

    if (deviceIndex === -1) {
      throw new Error("Device not found in this layout");
    }

    const newRow = positionData.row !== undefined ? positionData.row : layout.devices[deviceIndex].row;
    const newCol = positionData.column !== undefined ? positionData.column : layout.devices[deviceIndex].column;
    const newRowSpan = positionData.rowSpan !== undefined ? positionData.rowSpan : layout.devices[deviceIndex].rowSpan;
    const newColSpan = positionData.colSpan !== undefined ? positionData.colSpan : layout.devices[deviceIndex].colSpan;

    if (
      newRow < 0 ||
      newCol < 0 ||
      newRow + newRowSpan > layout.rows ||
      newCol + newColSpan > layout.columns
    ) {
      throw new Error("Device position or size exceeds grid bounds");
    }

    if (positionData.row !== undefined) layout.devices[deviceIndex].row = positionData.row;
    if (positionData.column !== undefined) layout.devices[deviceIndex].column = positionData.column;
    if (positionData.rowSpan !== undefined) layout.devices[deviceIndex].rowSpan = positionData.rowSpan;
    if (positionData.colSpan !== undefined) layout.devices[deviceIndex].colSpan = positionData.colSpan;

    await layout.save();
    return layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);
  }

  async bulkUpdateDevicePositions(
    layoutId: string,
    deviceUpdates: Array<{
      deviceId: string;
      row: number;
      column: number;
      rowSpan: number;
      colSpan: number;
    }>
  ): Promise<GridLayoutDocument | null> {
    const layout = await GridLayout.findById(layoutId);

    if (!layout) {
      return null;
    }

    for (const deviceUpdate of deviceUpdates) {
      const deviceIndex = layout.devices.findIndex(
        (d) => d.deviceId.toString() === deviceUpdate.deviceId
      );

      if (deviceIndex === -1) {
        throw new Error(`Device ${deviceUpdate.deviceId} not found in this layout`);
      }

      if (
        deviceUpdate.row < 0 ||
        deviceUpdate.column < 0 ||
        deviceUpdate.row + deviceUpdate.rowSpan > layout.rows ||
        deviceUpdate.column + deviceUpdate.colSpan > layout.columns
      ) {
        throw new Error(
          `Device ${deviceUpdate.deviceId} position or size exceeds grid bounds`
        );
      }
    }

    for (const deviceUpdate of deviceUpdates) {
      const deviceIndex = layout.devices.findIndex(
        (d) => d.deviceId.toString() === deviceUpdate.deviceId
      );

      layout.devices[deviceIndex].row = deviceUpdate.row;
      layout.devices[deviceIndex].column = deviceUpdate.column;
      layout.devices[deviceIndex].rowSpan = deviceUpdate.rowSpan;
      layout.devices[deviceIndex].colSpan = deviceUpdate.colSpan;
    }

    await layout.save();
    return layout.populate([
      { path: "createdBy", select: "name email username" },
      { path: "devices.deviceId", select: "name status deviceTypeId location" }
    ]);
  }

  async remove(id: string): Promise<GridLayoutDocument | null> {
    return GridLayout.findByIdAndDelete(id).exec();
  }

  private async validateDevices(
    devices: IDevicePosition[],
    columns: number,
    rows: number
  ): Promise<void> {
    const deviceIds = devices.map((d) => d.deviceId);
    const existingDevices = await Device.find({
      _id: { $in: deviceIds }
    }).setOptions({ includeDeleted: false });

    if (existingDevices.length !== deviceIds.length) {
      throw new Error("One or more devices not found");
    }

    for (const device of devices) {
      if (
        device.row < 0 ||
        device.column < 0 ||
        device.row + device.rowSpan > rows ||
        device.column + device.colSpan > columns
      ) {
        throw new Error("Device position or size exceeds grid bounds");
      }
    }
  }
}

export const gridLayoutService = new GridLayoutService();
