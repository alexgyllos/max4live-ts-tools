import { z } from "zod";
import { RawPatcherSchema } from "./raw-patcher.js";

export const RawMaxpatSchema = z
  .object({
    patcher: RawPatcherSchema,
  })
  .passthrough();

export type RawMaxpat = z.infer<typeof RawMaxpatSchema>;
