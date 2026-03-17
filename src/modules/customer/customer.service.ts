import { Customer, CustomerDocument } from "./customer.model";
import { CustomerDTO, CustomerFilters } from "./customer.types";
export class CustomerService {
  async list(_filters: CustomerFilters = {}): Promise<CustomerDocument[]> {
    // TODO: apply filters
    return Customer.find().exec();
  }
  async getById(id: string): Promise<CustomerDocument | null> {
    return Customer.findById(id).exec();
  }
  async create(data: CustomerDTO): Promise<CustomerDocument> {
    const doc = new Customer(data);
    return doc.save();
  }
  async update(
    id: string,
    data: Partial<CustomerDTO>
  ): Promise<CustomerDocument | null> {
    return Customer.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  async remove(id: string): Promise<CustomerDocument | null> {
    return Customer.findByIdAndDelete(id).exec();
  }
}
export const customerService = new CustomerService();
