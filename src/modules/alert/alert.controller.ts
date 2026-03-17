import { Request, Response, NextFunction } from "express";
import { alertService } from "./alert.service";
export class AlertController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await alertService.list(req.query as any);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await alertService.getById(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, message: "Alert not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await alertService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await alertService.update(req.params.id, req.body);
      if (!item) {
        res.status(404).json({ success: false, message: "Alert not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await alertService.remove(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, message: "Alert not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
export const alertController = new AlertController();
