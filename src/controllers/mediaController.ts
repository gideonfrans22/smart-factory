import { Request, Response } from "express";
import { Media } from "../models/Media";
import { APIResponse, AuthenticatedRequest } from "../types";
import fs from "fs";

/**
 * Upload single media file
 * POST /api/media/upload
 */
export const uploadMedia = async (
  req: AuthenticatedRequest,
  res: Response
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

    const { type } = req.body;

    const originalNameUtf8 = Buffer.from(
      req.file.originalname,
      "latin1"
    ).toString("utf8");

    // Create media document
    const media = new Media({
      filename: req.file.filename,
      originalName: originalNameUtf8,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
      uploadedBy: req.user?._id,
      type: type || undefined
    });

    await media.save();

    const response: APIResponse = {
      success: true,
      message: "File uploaded successfully",
      data: media
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Upload media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Upload multiple media files
 * POST /api/media/upload/multiple
 */
export const uploadMultipleMedia = async (
  req: AuthenticatedRequest,
  res: Response
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

    const { type } = req.body;

    // Create media documents for all files
    const mediaDocuments = req.files.map((file) => {
      const originalNameUtf8 = Buffer.from(
        file.originalname,
        "latin1"
      ).toString("utf8");
      return {
        filename: file.filename,
        originalName: originalNameUtf8,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        uploadedBy: req.user?._id,
        type: type || undefined
      };
    });

    const savedMedia = await Media.insertMany(mediaDocuments);

    const response: APIResponse = {
      success: true,
      message: `${savedMedia.length} files uploaded successfully`,
      data: savedMedia
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Upload multiple media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get media by ID
 * GET /api/media/:id
 */
export const getMediaById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const media = await Media.findById(id).populate(
      "uploadedBy",
      "username email"
    );

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
    console.error("Get media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * View/Preview media file (inline display)
 * GET /api/media/:id/view
 * Can be used in img tags, iframes, etc.
 */
export const viewMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const media = await Media.findById(id);

    if (!media) {
      // Return 404 with generic image for failed requests
      res.status(404).send("Media not found");
      return;
    }

    // Check if file exists
    if (!fs.existsSync(media.filePath)) {
      res.status(404).send("File not found on server");
      return;
    }

    // Set appropriate headers for inline display (not download)
    res.setHeader("Content-Type", media.mimeType);
    res.setHeader("Content-Length", media.fileSize.toString());

    // Add cache headers for better performance
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year
    res.setHeader("ETag", `"${media._id}"`);

    // Stream the file
    const fileStream = fs.createReadStream(media.filePath);
    fileStream.on("error", (error) => {
      console.error("Stream error:", error);
      res.status(500).send("Error reading file");
    });
    fileStream.pipe(res);
  } catch (error) {
    console.error("View media error:", error);
    res.status(500).send("Internal server error");
  }
};

/**
 * Download media file
 * GET /api/media/:id/download
 */
export const downloadMedia = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const media = await Media.findById(id);

    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if file exists
    if (!fs.existsSync(media.filePath)) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "File not found on server"
      };
      res.status(404).json(response);
      return;
    }

    // Set appropriate headers
    res.setHeader("Content-Type", media.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(media.originalName)}"`
    );
    res.setHeader("Content-Length", media.fileSize.toString());

    // Stream the file
    const fileStream = fs.createReadStream(media.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Delete media file
 * DELETE /api/media/:id
 */
export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const media = await Media.findById(id);

    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    // Delete file from filesystem
    if (fs.existsSync(media.filePath)) {
      fs.unlinkSync(media.filePath);
    }

    // Delete document from database
    await Media.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "Media deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
