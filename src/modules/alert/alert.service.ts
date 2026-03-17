import { Alert, AlertDocument } from "./alert.model";
  import { AlertDTO, AlertFilters } from "./alert.types";
  export class AlertService {
    async list(filters: AlertFilters = {}): Promise<AlertDocument[]> {
      // TODO: apply filters
      return Alert.find().exec();
    }
    async getById(id: string): Promise<AlertDocument | null> {
      return Alert.findById(id).exec();
    }
    async create(data: AlertDTO): Promise<AlertDocument> {
      const doc = new Alert(data);
      return doc.save();
    }
    async update(id: string, data: Partial<AlertDTO>): Promise<AlertDocument | null> {
      return Alert.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async remove(id: string): Promise<AlertDocument | null> {
      return Alert.findByIdAndDelete(id).exec();
    }
  }
  export const alertService = new AlertService();
  