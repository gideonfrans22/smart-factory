import { z } from "zod";

export const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional()
  );
