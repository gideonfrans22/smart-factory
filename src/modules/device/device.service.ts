import { Device, DeviceDocument } from "./device.model";
import { DeviceDTO, DeviceFilters } from "./device.types";
export class DeviceService {
  async list(_filters: DeviceFilters = {}): Promise<DeviceDocument[]> {
    // TODO: apply filters
    return Device.find().exec();
  }
  async getById(id: string): Promise<DeviceDocument | null> {
    return Device.findById(id).exec();
  }
  async create(data: DeviceDTO): Promise<DeviceDocument> {
    const doc = new Device(data);
    return doc.save();
  }
  async update(
    id: string,
    data: Partial<DeviceDTO>
  ): Promise<DeviceDocument | null> {
    return Device.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  async remove(id: string): Promise<DeviceDocument | null> {
    return Device.findByIdAndDelete(id).exec();
  }
}
export const deviceService = new DeviceService();
