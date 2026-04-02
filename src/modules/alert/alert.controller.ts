import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { alertService, AlertServiceError } from "./alert.service";
import {
  AlertBulkIdsInput,
  AlertCreateInput,
  AlertListQueryInput,
  AlertResolveEmergencyBodyInput
} from "./alert.validators";
import { APIResponse, AuthenticatedRequest } from "@shared/types";

export class AlertController {
  async list(
    req: AuthenticatedRequest & { query: AlertListQueryInput },
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await alertService.list(req.query);
      const response: APIResponse = {
        success: true,
        message: "Alerts retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: AuthenticatedRequest & { params: { id: string } },
    res: Response,
    next: NextFunction
  ) {
    try {
      const alert = await alertService.getById(req.params.id);
      if (!alert) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Alert not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Alert retrieved successfully",
        data: alert
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: AuthenticatedRequest & { body: AlertCreateInput },
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        type,
        level,
        title,
        message,
        source,
        relatedEntityType,
        relatedEntityId,
        deviceId,
        taskId,
        projectId,
        reportedBy,
        metadata,
        status
      } = req.body;

      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;

      const { alert, emergencyActions } = await alertService.create(
        {
          type,
          level,
          title,
          message,
          source,
          relatedEntityType,
          relatedEntityId,
          deviceId,
          taskId,
          projectId,
          reportedBy,
          metadata,
          status
        },
        userId
      );

      const response: APIResponse = {
        success: true,
        message:
          level === "CRITICAL" || level === "HIGH"
            ? "Emergency alert created with automatic actions"
            : "Alert created successfully",
        data: {
          alert,
          emergencyActions
        }
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async acknowledge(
    req: AuthenticatedRequest & { params: { id: string } },
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const alert = await alertService.acknowledge(req.params.id, userId);

      if (!alert) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Alert not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Alert acknowledged successfully",
        data: alert
      };

      res.json(response);
    } catch (error: unknown) {
      if (
        error instanceof AlertServiceError &&
        error.errorCode === "ALREADY_RESOLVED"
      ) {
        const response: APIResponse = {
          success: false,
          error: "ALREADY_RESOLVED",
          message: "Cannot acknowledge resolved alert"
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  }

  async read(
    req: AuthenticatedRequest & { params: { id: string } },
    res: Response,
    next: NextFunction
  ) {
    try {
      const alert = await alertService.markRead(req.params.id);

      if (!alert) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Alert not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Alert marked as read successfully",
        data: alert
      };

      res.json(response);
    } catch (error: unknown) {
      if (
        error instanceof AlertServiceError &&
        error.errorCode === "ALREADY_RESOLVED"
      ) {
        const response: APIResponse = {
          success: false,
          error: "ALREADY_RESOLVED",
          message: "Cannot mark resolved alert as read"
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  }

  async resolve(
    req: AuthenticatedRequest & { params: { id: string } },
    res: Response,
    next: NextFunction
  ) {
    try {
      const resolvedByUserId = req.user?.id;
      const alert = await alertService.resolve(req.params.id, resolvedByUserId);

      if (!alert) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Alert not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Alert resolved successfully",
        data: alert
      };

      res.json(response);
    } catch (error: unknown) {
      if (
        error instanceof AlertServiceError &&
        error.errorCode === "ALREADY_RESOLVED"
      ) {
        const response: APIResponse = {
          success: false,
          error: "ALREADY_RESOLVED",
          message: "Alert is already resolved"
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  }

  async bulkRead(
    req: AuthenticatedRequest & { body: AlertBulkIdsInput },
    res: Response,
    next: NextFunction
  ) {
    try {
      const { alertIds } = req.body;

      if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "alertIds array is required and must not be empty"
        };
        res.status(400).json(response);
        return;
      }

      const result = await alertService.bulkRead(req.body);

      const response: APIResponse = {
        success: true,
        message: `${result.modifiedCount} alert(s) marked as read successfully`,
        data: {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async bulkAcknowledge(
    req: AuthenticatedRequest & { body: AlertBulkIdsInput },
    res: Response,
    next: NextFunction
  ) {
    try {
      const { alertIds } = req.body;

      if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "alertIds array is required and must not be empty"
        };
        res.status(400).json(response);
        return;
      }

      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const result = await alertService.bulkAcknowledge(req.body, userId);

      const response: APIResponse = {
        success: true,
        message: `${result.modifiedCount} alert(s) acknowledged successfully`,
        data: {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async bulkResolve(
    req: AuthenticatedRequest & { body: AlertBulkIdsInput },
    res: Response,
    next: NextFunction
  ) {
    try {
      const { alertIds } = req.body;

      if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "alertIds array is required and must not be empty"
        };
        res.status(400).json(response);
        return;
      }

      const resolvedByUserId = req.user?.id;
      const result = await alertService.bulkResolve(req.body, resolvedByUserId);

      const response: APIResponse = {
        success: true,
        message: `${result.modifiedCount} alert(s) resolved successfully`,
        data: {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(
    req: AuthenticatedRequest & { params: { id: string } },
    res: Response,
    next: NextFunction
  ) {
    try {
      const alert = await alertService.delete(req.params.id);

      if (!alert) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Alert not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Alert deleted successfully"
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async resolveEmergency(
    req: AuthenticatedRequest & {
      params: { id: string };
      body: AlertResolveEmergencyBodyInput;
    },
    res: Response,
    next: NextFunction
  ) {
    try {
      const resolvedByName = req.user?.name;
      const result = await alertService.resolveEmergency(
        req.params.id,
        req.body,
        resolvedByName
      );

      if (!result) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Alert not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Emergency resolved successfully",
        data: {
          alert: result.alert,
          actionsPerformed: result.actionsPerformed
        }
      };

      res.json(response);
    } catch (error: unknown) {
      if (
        error instanceof AlertServiceError &&
        error.errorCode === "INVALID_TYPE"
      ) {
        const response: APIResponse = {
          success: false,
          error: "INVALID_TYPE",
          message:
            "Only CRITICAL level alerts can be resolved with this endpoint"
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  }

  async stats(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await alertService.getStats();
      const response: APIResponse = {
        success: true,
        message: "Alert statistics retrieved successfully",
        data: result
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const alertController = new AlertController();

