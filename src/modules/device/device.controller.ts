import { Request, Response, NextFunction } from "express";
  import { deviceService } from "./device.service";
  export class DeviceController {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const items = await deviceService.list(req.query as any);
        res.json({ success: true, data: items });
      } catch (error) {
        next(error);
      }
    }
    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await deviceService.getById(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "Device not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await deviceService.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await deviceService.update(req.params.id, req.body);
        if (!item) {
          return res.status(404).json({ success: false, message: "Device not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await deviceService.remove(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "Device not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  }
  export const deviceController = new DeviceController();
  