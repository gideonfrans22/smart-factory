import { Task, TaskDocument } from "./task.model";
import { TaskDTO, TaskFilters } from "./task.types";
export class TaskService {
  async list(_filters: TaskFilters = {}): Promise<TaskDocument[]> {
    // TODO: apply filters
    return Task.find().exec();
  }
  async getById(id: string): Promise<TaskDocument | null> {
    return Task.findById(id).exec();
  }
  async create(data: TaskDTO): Promise<TaskDocument> {
    const doc = new Task(data);
    return doc.save();
  }
  async update(
    id: string,
    data: Partial<TaskDTO>
  ): Promise<TaskDocument | null> {
    return Task.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  async remove(id: string): Promise<TaskDocument | null> {
    return Task.findByIdAndDelete(id).exec();
  }
}
export const taskService = new TaskService();
