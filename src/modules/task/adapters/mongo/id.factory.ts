import mongoose from "mongoose";
import type { IdFactory } from "../../ports/IdFactory";

export class MongoIdFactory implements IdFactory {
  newObjectIdHex(): string {
    return new mongoose.Types.ObjectId().toHexString();
  }
}

export const mongoIdFactory = new MongoIdFactory();

