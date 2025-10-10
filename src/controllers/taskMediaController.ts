import { Response } from "express";
import { TaskMedia } from "../models/TaskMedia";
import { Task } from "../models/Task";
import { APIResponse, AuthenticatedRequest } from "../types";
import { getFileInfo, deleteUploadedFile } from "../middleware/upload";
import path from "path";

export const uploadTaskMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { uploadType } = req.body;
    const userId = req.user?._id;

    // Check if task exists
    const task = await Task.findById(taskId);
    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if file was uploaded
    if (!req.file) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "No file uploaded"
      };
      res.status(400).json(response);
      return;
    }

    // Get file information
    const fileInfo = getFileInfo(req.file);

    // Create TaskMedia document
    const taskMedia = new TaskMedia({
      taskId,
      uploadType: uploadType || "PHOTO",
      filePath: fileInfo.path,
      filename: fileInfo.filename,
      originalName: fileInfo.originalName,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimeType,
      uploadedBy: userId
    });

    await taskMedia.save();
    await taskMedia.populate("uploadedBy", "name empNo");

    const response: APIResponse = {
      success: true,
      message: "File uploaded successfully",
      data: taskMedia
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Upload task media error:", error);

    // Clean up uploaded file on error
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to upload file"
    };
    res.status(500).json(response);
  }
};

export const uploadMultipleTaskMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { uploadType } = req.body;
    const userId = req.user?._id;

    // Check if task exists
    const task = await Task.findById(taskId);
    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if files were uploaded
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "No files uploaded"
      };
      res.status(400).json(response);
      return;
    }

    // Create TaskMedia documents for all files
    const uploadedMedia = [];
    for (const file of req.files) {
      const fileInfo = getFileInfo(file);

      const taskMedia = new TaskMedia({
        taskId,
        uploadType: uploadType || "PHOTO",
        filePath: fileInfo.path,
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimeType,
        uploadedBy: userId
      });

      await taskMedia.save();
      await taskMedia.populate("uploadedBy", "name empNo");
      uploadedMedia.push(taskMedia);
    }

    const response: APIResponse = {
      success: true,
      message: `${uploadedMedia.length} file(s) uploaded successfully`,
      data: uploadedMedia
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Upload multiple task media error:", error);

    // Clean up uploaded files on error
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        deleteUploadedFile(file.path);
      });
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to upload files"
    };
    res.status(500).json(response);
  }
};

export const getTaskMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { taskId } = req.params;

    const media = await TaskMedia.find({ taskId })
      .populate("uploadedBy", "name empNo")
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Task media retrieved successfully",
      data: media
    };

    res.json(response);
  } catch (error) {
    console.error("Get task media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const deleteTaskMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const media = await TaskMedia.findById(id);

    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    // Delete the physical file
    deleteUploadedFile(media.filePath);

    // Delete the database record
    await TaskMedia.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "Media deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete task media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const downloadTaskMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const media = await TaskMedia.findById(id);

    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    // Send file
    const filePath = path.resolve(media.filePath);
    res.download(filePath, media.originalName);
  } catch (error) {
    console.error("Download task media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
