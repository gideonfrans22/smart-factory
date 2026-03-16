import { NextFunction, Request, Response } from "express";

export function runMiddleware(
  req: Request,
  res: Response,
  fn: (req: Request, res: Response, next: NextFunction) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (err: unknown) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

