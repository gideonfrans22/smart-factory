import { Request, Response, NextFunction } from "express";
  import { taskService } from "./task.service";
  export class TaskController {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const items = await taskService.list(req.query as any);
        res.json({ success: true, data: items });
      } catch (error) {
        next(error);
      }
    }
    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await taskService.getById(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "Task not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await taskService.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await taskService.update(req.params.id, req.body);
        if (!item) {
          return res.status(404).json({ success: false, message: "Task not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await taskService.remove(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "Task not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  }
  export const taskController = new TaskController();
  