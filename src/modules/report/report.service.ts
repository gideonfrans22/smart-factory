import { Report, ReportDocument } from "./report.model";
import { ReportDTO, ReportFilters } from "./report.types";
export class ReportService {
  async list(_filters: ReportFilters = {}): Promise<ReportDocument[]> {
    // TODO: apply filters
    return Report.find().exec();
  }
  async getById(id: string): Promise<ReportDocument | null> {
    return Report.findById(id).exec();
  }
  async create(data: ReportDTO): Promise<ReportDocument> {
    const doc = new Report(data);
    return doc.save();
  }
  async update(
    id: string,
    data: Partial<ReportDTO>
  ): Promise<ReportDocument | null> {
    return Report.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  async remove(id: string): Promise<ReportDocument | null> {
    return Report.findByIdAndDelete(id).exec();
  }
}
export const reportService = new ReportService();
