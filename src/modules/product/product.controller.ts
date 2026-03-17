import { Request, Response, NextFunction } from "express";
import { productService } from "./product.service";
export class ProductController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await productService.list(req.query as any);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await productService.getById(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, message: "Product not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await productService.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await productService.update(req.params.id, req.body);
      if (!item) {
        res.status(404).json({ success: false, message: "Product not found" });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await productService.remove(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, message: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
export const productController = new ProductController();
