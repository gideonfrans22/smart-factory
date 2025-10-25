import { Response } from "express";
import { Recipe } from "../models/Recipe";
import { APIResponse, AuthenticatedRequest } from "../types";
import { getFileInfo, deleteUploadedFile } from "../middleware/upload";
import path from "path";

// Get all media for a specific recipe step
export const getStepMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { recipeId, stepId } = req.params;

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(response);
      return;
    }

    const step = recipe.steps.find((s) => s._id.toString() === stepId);
    if (!step) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe step not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Step media retrieved successfully",
      data: step.media || []
    };
    res.json(response);
  } catch (error) {
    console.error("Get step media error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Upload media to a recipe step
export const uploadStepMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { recipeId, stepId } = req.params;
    const { mediaType, description } = req.body;

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

    // Validate media type
    const validMediaTypes = [
      "INSTRUCTION",
      "DIAGRAM",
      "VIDEO",
      "QUALITY_CHECK"
    ];
    if (mediaType && !validMediaTypes.includes(mediaType)) {
      // Clean up uploaded file
      deleteUploadedFile(req.file.path);

      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Invalid media type. Must be one of: ${validMediaTypes.join(
          ", "
        )}`
      };
      res.status(400).json(response);
      return;
    }

    // Check if recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      // Clean up uploaded file
      deleteUploadedFile(req.file.path);

      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if step exists
    const step = recipe.steps.find((s) => s._id.toString() === stepId);
    if (!step) {
      // Clean up uploaded file
      deleteUploadedFile(req.file.path);

      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe step not found"
      };
      res.status(404).json(response);
      return;
    }

    // Get file information
    const fileInfo = getFileInfo(req.file);

    // Create media object (MongoDB will auto-generate _id)
    const media = {
      filename: fileInfo.filename,
      originalName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      fileSize: fileInfo.size,
      filePath: fileInfo.path,
      mediaType: mediaType || "INSTRUCTION",
      description: description || "",
      uploadedAt: new Date()
    };

    // Add media to step
    if (!step.media) {
      step.media = [];
    }
    step.media.push(media as any); // MongoDB will add _id on save

    await recipe.save();

    // Get the saved media with _id
    const savedMedia = step.media[step.media.length - 1];

    const response: APIResponse = {
      success: true,
      message: "Media uploaded successfully",
      data: savedMedia
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Upload step media error:", error);

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

// Upload multiple media files to a recipe step
export const uploadMultipleStepMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { recipeId, stepId } = req.params;
    const { mediaType, description } = req.body;

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

    // Validate media type
    const validMediaTypes = [
      "INSTRUCTION",
      "DIAGRAM",
      "VIDEO",
      "QUALITY_CHECK"
    ];
    if (mediaType && !validMediaTypes.includes(mediaType)) {
      // Clean up all uploaded files
      req.files.forEach((file) => {
        deleteUploadedFile(file.path);
      });

      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Invalid media type. Must be one of: ${validMediaTypes.join(
          ", "
        )}`
      };
      res.status(400).json(response);
      return;
    }

    // Check if recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      // Clean up all uploaded files
      req.files.forEach((file) => {
        deleteUploadedFile(file.path);
      });

      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if step exists
    const step = recipe.steps.find((s) => s._id.toString() === stepId);
    if (!step) {
      // Clean up all uploaded files
      req.files.forEach((file) => {
        deleteUploadedFile(file.path);
      });

      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe step not found"
      };
      res.status(404).json(response);
      return;
    }

    // Initialize media array if needed
    if (!step.media) {
      step.media = [];
    }

    // Create media objects for all files (MongoDB will auto-generate _id for each)
    const uploadedMedia = req.files.map((file) => {
      const fileInfo = getFileInfo(file);
      return {
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        mimeType: fileInfo.mimeType,
        fileSize: fileInfo.size,
        filePath: fileInfo.path,
        mediaType: mediaType || "INSTRUCTION",
        description: description || "",
        uploadedAt: new Date()
      };
    });

    // Add all media to step
    step.media.push(...(uploadedMedia as any)); // MongoDB will add _id on save

    await recipe.save();

    // Get the saved media with _id
    const savedMedia = step.media.slice(-uploadedMedia.length);

    const response: APIResponse = {
      success: true,
      message: `${uploadedMedia.length} media files uploaded successfully`,
      data: savedMedia
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Upload multiple step media error:", error);

    // Clean up all uploaded files on error
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

// Download/view a specific media file
export const downloadStepMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { recipeId, stepId, mediaId } = req.params;

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(response);
      return;
    }

    const step = recipe.steps.find((s) => s._id.toString() === stepId);
    if (!step) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe step not found"
      };
      res.status(404).json(response);
      return;
    }

    const media = step.media?.find((m) => m._id.toString() === mediaId);
    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    // Resolve file path for security
    const filePath = path.resolve(media.filePath);

    // Send file
    res.download(filePath, media.originalName);
  } catch (error) {
    console.error("Download step media error:", error);

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Delete a specific media file
export const deleteStepMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { recipeId, stepId, mediaId } = req.params;

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(response);
      return;
    }

    const step = recipe.steps.find((s) => s._id.toString() === stepId);
    if (!step) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe step not found"
      };
      res.status(404).json(response);
      return;
    }

    const mediaIndex = step.media?.findIndex(
      (m) => m._id.toString() === mediaId
    );
    if (mediaIndex === undefined || mediaIndex === -1) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    const media = step.media![mediaIndex];

    // Delete file from filesystem using helper
    deleteUploadedFile(media.filePath);

    // Remove from array
    step.media!.splice(mediaIndex, 1);

    await recipe.save();

    const response: APIResponse = {
      success: true,
      message: "Media deleted successfully",
      data: null
    };
    res.json(response);
  } catch (error) {
    console.error("Delete step media error:", error);

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Update media metadata (type, description)
export const updateStepMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { recipeId, stepId, mediaId } = req.params;
    const { mediaType, description } = req.body;

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(response);
      return;
    }

    const step = recipe.steps.find((s) => s._id.toString() === stepId);
    if (!step) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe step not found"
      };
      res.status(404).json(response);
      return;
    }

    const media = step.media?.find((m) => m._id.toString() === mediaId);
    if (!media) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Media not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate media type if provided
    if (mediaType) {
      const validMediaTypes = [
        "INSTRUCTION",
        "DIAGRAM",
        "VIDEO",
        "QUALITY_CHECK"
      ];
      if (!validMediaTypes.includes(mediaType)) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: `Invalid media type. Must be one of: ${validMediaTypes.join(
            ", "
          )}`
        };
        res.status(400).json(response);
        return;
      }
      media.mediaType = mediaType;
    }

    if (description !== undefined) {
      media.description = description;
    }

    await recipe.save();

    const response: APIResponse = {
      success: true,
      message: "Media updated successfully",
      data: media
    };
    res.json(response);
  } catch (error) {
    console.error("Update step media error:", error);

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
