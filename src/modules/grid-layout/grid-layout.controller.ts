import { Request, Response, NextFunction } from "express";
  import { gridLayoutService } from "./grid-layout.service";
  export class GridLayoutController {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const items = await gridLayoutService.list(req.query as any);
        res.json({ success: true, data: items });
      } catch (error) {
        next(error);
      }
    }
    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await gridLayoutService.getById(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "GridLayout not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await gridLayoutService.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await gridLayoutService.update(req.params.id, req.body);
        if (!item) {
          return res.status(404).json({ success: false, message: "GridLayout not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await gridLayoutService.remove(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "GridLayout not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  }
  export const gridLayoutController = new GridLayoutController();
  