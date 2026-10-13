import { z } from "zod";
import { RawBoxWrapperSchema, RectSchema, type RawBox } from "./raw-box.js";
import { RawPatchlineWrapperSchema } from "./raw-patchline.js";
export type RawPatcher = Record<string, unknown> & {
  boxes: Array<Record<string, unknown> & { box: RawBox }>;
  lines?: Array<z.infer<typeof RawPatchlineWrapperSchema>>;
  rect?: [number, number, number, number];
};
export const RawPatcherSchema: z.ZodType<RawPatcher> = z
  .object({
    boxes: z.array(RawBoxWrapperSchema).max(100000),
    lines: z.array(RawPatchlineWrapperSchema).max(200000).optional(),
    rect: RectSchema.optional(),
  })
  .passthrough();
