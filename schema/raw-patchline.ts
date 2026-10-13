import { z } from "zod";

// A patchline endpoint: [boxId, portIndex]
const PatchlineEndpointSchema = z.tuple([
  z.string().min(1),
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
]);

const RawPatchlineSchema = z
  .object({
    source: PatchlineEndpointSchema,
    destination: PatchlineEndpointSchema,
  })
  .passthrough();

export const RawPatchlineWrapperSchema = z
  .object({
    patchline: RawPatchlineSchema,
  })
  .passthrough();
