import { Request, Response, NextFunction } from "express";
  import { userService } from "./user.service";
  export class UserController {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const items = await userService.list(req.query as any);
        res.json({ success: true, data: items });
      } catch (error) {
        next(error);
      }
    }
    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await userService.getById(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await userService.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await userService.update(req.params.id, req.body);
        if (!item) {
          return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await userService.remove(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  }
  export const userController = new UserController();
  