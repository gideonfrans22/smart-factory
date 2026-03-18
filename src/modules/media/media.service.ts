import fs from "fs";
import mongoose from "mongoose";
import { Media, IMedia } from "./media.model";

export class MediaService {
  async createFromUploadedFile(
    file: Express.Multer.File,
    uploadedBy?: mongoose.Types.ObjectId,
    type?: string
  ) {
    const originalNameUtf8 = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );

    const media = new Media({
      filename: file.filename,
      originalName: originalNameUtf8,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      uploadedBy,
      type: type || undefined
    });

    await media.save();
    return media;
  }

  async createManyFromUploadedFiles(
    files: Express.Multer.File[],
    uploadedBy?: mongoose.Types.ObjectId,
    type?: string
  ) {
    const docs = files.map((file) => {
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
        uploadedBy,
        type: type || undefined
      };
    });

    return await Media.insertMany(docs);
  }

  async getById(id: string, opts?: { populateUploader?: boolean }) {
    const query = Media.findById(id);
    if (opts?.populateUploader) {
      query.populate("uploadedBy", "username email");
    }
    return await query;
  }

  async deleteById(id: string): Promise<IMedia | null> {
    const media = await Media.findById(id);
    if (!media) return null;

    if (media.filePath && fs.existsSync(media.filePath)) {
      fs.unlinkSync(media.filePath);
    }

    await Media.findByIdAndDelete(id);
    return media;
  }
}

export const mediaService = new MediaService();
