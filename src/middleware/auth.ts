import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthenticatedRequest, JWTPayload, APIResponse } from '../types';

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      const response: APIResponse = {
        success: false,
        message: 'Access token required'
      };
      res.status(401).json(response);
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      const response: APIResponse = {
        success: false,
        message: 'Invalid or inactive user'
      };
      res.status(401).json(response);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    const response: APIResponse = {
      success: false,
      message: 'Invalid token'
    };
    res.status(403).json(response);
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: APIResponse = {
        success: false,
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    if (!roles.includes(req.user.role)) {
      const response: APIResponse = {
        success: false,
        message: 'Insufficient permissions'
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};

export const requireManager = requireRole(['manager']);
export const requireWorker = requireRole(['worker']);
export const requireAnyRole = requireRole(['manager', 'worker']);
