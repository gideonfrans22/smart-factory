export interface IdFactory {
  /** Returns a Mongo ObjectId hex string (24 chars). */
  newObjectIdHex(): string;
}

