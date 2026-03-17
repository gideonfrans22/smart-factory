import { User, UserDocument } from "./user.model";
  import { UserDTO, UserFilters } from "./user.types";
  export class UserService {
    async list(filters: UserFilters = {}): Promise<UserDocument[]> {
      // TODO: apply filters
      return User.find().exec();
    }
    async getById(id: string): Promise<UserDocument | null> {
      return User.findById(id).exec();
    }
    async create(data: UserDTO): Promise<UserDocument> {
      const doc = new User(data);
      return doc.save();
    }
    async update(id: string, data: Partial<UserDTO>): Promise<UserDocument | null> {
      return User.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async remove(id: string): Promise<UserDocument | null> {
      return User.findByIdAndDelete(id).exec();
    }
  }
  export const userService = new UserService();
  