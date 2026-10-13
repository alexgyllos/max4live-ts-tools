import { z } from "zod";
import { RawPatcherSchema, type RawPatcher } from "./raw-patcher.js";
export const RectSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite().nonnegative(),
  z.number().finite().nonnegative(),
]);
export type RawBox = Record<string, unknown> & {
  id: string;
  maxclass: string;
  numinlets: number;
  numoutlets: number;
  patching_rect: [number, number, number, number];
  patcher?: RawPatcher;
};
export const RawBoxSchema: z.ZodType<RawBox> = z
  .object({
    id: z.string().min(1),
    maxclass: z.string().min(1),
    numinlets: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    numoutlets: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    patching_rect: RectSchema,
    patcher: z.lazy(() => RawPatcherSchema).optional(),
  })
  .passthrough();
export const RawBoxWrapperSchema = z
  .object({ box: RawBoxSchema })
  .passthrough();
