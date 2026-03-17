import { Request, Response, NextFunction } from "express";
import { customerService } from "./customer.service";
export class CustomerController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await customerService.list(req.query as any);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await customerService.getById(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, message: "Customer not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await customerService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await customerService.update(req.params.id, req.body);
      if (!item) {
        res.status(404).json({ success: false, message: "Customer not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await customerService.remove(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, message: "Customer not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
export const customerController = new CustomerController();
