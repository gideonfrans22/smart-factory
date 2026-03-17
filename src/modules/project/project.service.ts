import { Project, ProjectDocument } from "./project.model";
  import { ProjectDTO, ProjectFilters } from "./project.types";
  export class ProjectService {
    async list(filters: ProjectFilters = {}): Promise<ProjectDocument[]> {
      // TODO: apply filters
      return Project.find().exec();
    }
    async getById(id: string): Promise<ProjectDocument | null> {
      return Project.findById(id).exec();
    }
    async create(data: ProjectDTO): Promise<ProjectDocument> {
      const doc = new Project(data);
      return doc.save();
    }
    async update(id: string, data: Partial<ProjectDTO>): Promise<ProjectDocument | null> {
      return Project.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async remove(id: string): Promise<ProjectDocument | null> {
      return Project.findByIdAndDelete(id).exec();
    }
  }
  export const projectService = new ProjectService();
  