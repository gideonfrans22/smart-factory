import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/media");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // 1. FIX ENCODING FIRST
    // We take the "garbage" (latin1) and cast it back to a Buffer,
    // then read that buffer correctly as UTF-8.
    const originalNameUtf8 = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );

    // 2. SANITIZE WITH UNICODE SUPPORT
    // \p{L} matches any letter from any language (including Hangeul)
    // \p{N} matches any number
    // 'u' flag is MANDATORY for Unicode property escapes
    const sanitizedName = originalNameUtf8.replace(/[^\p{L}\p{N}.-]/gu, "_");

    // 3. GENERATE FINAL FILENAME
    const uniqueSuffix = `${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")}`;
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

// File filter for allowed types
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allowed MIME types
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "text/plain",
    "text/csv",
    // Videos
    "video/mp4",
    "video/mpeg",
    "video/webm",
    "video/quicktime", // .mov
    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    // Drawings
    "application/vnd.dwg",
    "image/x-dwg",
    "application/acad",
    "image/x-dxf",
    "application/dxf",
    "drawing/x-dwf",
    "application/octet-stream" // for some CAD files
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: images, documents, videos, and archives.`
      )
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 10 // Max 10 files per request
  }
});

// Export middleware configurations
export const uploadSingle = upload.single("file");
export const uploadMultiple = upload.array("files", 10);

// Helper function to delete uploaded file
export const deleteUploadedFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

// Helper function to get file info
export const getFileInfo = (file: Express.Multer.File) => {
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    url: `/uploads/task-media/${file.filename}`
  };
};

export default upload;
