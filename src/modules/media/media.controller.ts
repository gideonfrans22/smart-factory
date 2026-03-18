import { Request, Response, NextFunction } from "express";
import { APIResponse, AuthenticatedRequest } from "@shared/types";
import fs from "fs";
import { mediaService } from "./media.service";

export const uploadMedia = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "No file uploaded"
      };
      res.status(400).json(response);
      return;
    }

    const { type } = req.body as any;

    const media = await mediaService.createFromUploadedFile(
      req.file,
      req.user?._id as any,
      type
    );

    const response: APIResponse = {
      success: true,
      message: "File uploaded successfully",
      data: media
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const uploadMultipleMedia = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "No files uploaded"
      };
      res.status(400).json(response);
      return;
    }

    const { type } = req.body as any;

    const savedMedia = await mediaService.createManyFromUploadedFiles(
      req.files as Express.Multer.File[],
      req.user?._id as any,
      type
    );

    const response: APIResponse = {
      success: true,
      message: `${savedMedia.length} files uploaded successfully`,
      data: savedMedia
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const getMediaById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const media = await mediaService.getById(id, { populateUploader: true });

    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Media retrieved successfully",
      data: media
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const viewMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const media = await mediaService.getById(id);

    if (!media) {
      res.status(404).send("Media not found");
      return;
    }

    if (!fs.existsSync(media.filePath)) {
      res.status(404).send("File not found on server");
      return;
    }

    res.setHeader("Content-Type", media.mimeType);
    res.setHeader("Content-Length", media.fileSize.toString());
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.setHeader("ETag", `"${media._id}"`);

    const fileStream = fs.createReadStream(media.filePath);
    fileStream.on("error", () => {
      res.status(500).send("Error reading file");
    });
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const downloadMedia = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const media = await mediaService.getById(id);

    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    if (!fs.existsSync(media.filePath)) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "File not found on server"
      };
      res.status(404).json(response);
      return;
    }

    res.setHeader("Content-Type", media.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(media.originalName)}"`
    );
    res.setHeader("Content-Length", media.fileSize.toString());

    const fileStream = fs.createReadStream(media.filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const deleteMedia = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const media = await mediaService.deleteById(id);

    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Media deleted successfully"
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

