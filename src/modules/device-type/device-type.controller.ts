import { Request, Response, NextFunction } from "express";
import { deviceTypeService } from "./device-type.service";
export class DeviceTypeController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await deviceTypeService.list(req.query as any);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await deviceTypeService.getById(req.params.id);
      if (!item) {
        res
          .status(404)
          .json({ success: false, message: "DeviceType not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await deviceTypeService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await deviceTypeService.update(req.params.id, req.body);
      if (!item) {
        res
          .status(404)
          .json({ success: false, message: "DeviceType not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await deviceTypeService.remove(req.params.id);
      if (!item) {
        res
          .status(404)
          .json({ success: false, message: "DeviceType not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
export const deviceTypeController = new DeviceTypeController();
