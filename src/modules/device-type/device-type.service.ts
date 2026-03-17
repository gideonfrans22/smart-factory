import { DeviceType, DeviceTypeDocument } from "./device-type.model";
  import { DeviceTypeDTO, DeviceTypeFilters } from "./device-type.types";
  export class DeviceTypeService {
    async list(filters: DeviceTypeFilters = {}): Promise<DeviceTypeDocument[]> {
      // TODO: apply filters
      return DeviceType.find().exec();
    }
    async getById(id: string): Promise<DeviceTypeDocument | null> {
      return DeviceType.findById(id).exec();
    }
    async create(data: DeviceTypeDTO): Promise<DeviceTypeDocument> {
      const doc = new DeviceType(data);
      return doc.save();
    }
    async update(id: string, data: Partial<DeviceTypeDTO>): Promise<DeviceTypeDocument | null> {
      return DeviceType.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async remove(id: string): Promise<DeviceTypeDocument | null> {
      return DeviceType.findByIdAndDelete(id).exec();
    }
  }
  export const deviceTypeService = new DeviceTypeService();
  